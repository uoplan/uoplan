import {
  type Catalogue,
  type Course,
  type DataCache,
  type SchedulesData,
  DataProto,
  buildDataCache,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoSchedulesData,
  isOptCourse,
  normalizeCourseCode,
  withExtraCourses,
} from "@uoplan/schedule";
import { fetchProtoBytes } from "./protoFetch";
import { getMergedCatalogue } from "../store/slices/catalogueUtils";

/**
 * Build a DataCache and inject fake entries for any OPT transfer credit codes in
 * `completedCourses`. Shared between the main-thread store and the schedule worker
 * so both build identical caches from identical inputs.
 */
export function buildCacheWithOpt(
  catalogue: Catalogue,
  schedulesData: SchedulesData,
  completedCourses: readonly string[],
): DataCache {
  const base = buildDataCache(catalogue, schedulesData);
  const optCodes = completedCourses.map(normalizeCourseCode).filter(isOptCourse);
  if (optCodes.length === 0) return base;
  return withExtraCourses(
    base,
    optCodes.map((code): Course => ({ code, title: code, credits: 3, description: "" })),
  );
}

/**
 * Identifies which `.pb` assets a DataCache needs. Used both as a postMessage
 * payload and as a memoization key on the worker side.
 */
export interface CacheDataKey {
  termId: string;
  firstYear: number | null;
  /** Completed course codes — only the subset matching {@link isOptCourse} affects the cache. */
  completedCourses: readonly string[];
}

interface MemoEntry {
  cache: DataCache;
  catalogue: Catalogue;
  schedulesData: SchedulesData;
  optKey: string;
}

const latestCataloguePromise = new Map<number, Promise<Catalogue>>();
const yearCataloguePromise = new Map<number, Promise<Catalogue>>();
const schedulesPromise = new Map<string, Promise<SchedulesData>>();
let manifestYearsPromise: Promise<number[]> | null = null;
const cacheMemo = new Map<string, MemoEntry>();

function loadManifestYears(): Promise<number[]> {
  if (!manifestYearsPromise) {
    manifestYearsPromise = fetchProtoBytes("/data/catalogue.pb").then(
      (bytes) => fromProtoCatalogueManifest(DataProto.CatalogueManifest.decode(bytes)).years,
    );
  }
  return manifestYearsPromise;
}

function loadCatalogueForYear(year: number): Promise<Catalogue> {
  let p = latestCataloguePromise.get(year);
  if (!p) {
    p = fetchProtoBytes(`/data/catalogue.${year}.pb`).then((bytes) =>
      fromProtoCatalogue(DataProto.Catalogue.decode(bytes)),
    );
    latestCataloguePromise.set(year, p);
  }
  return p;
}

function loadYearCatalogue(year: number): Promise<Catalogue> {
  let p = yearCataloguePromise.get(year);
  if (!p) {
    p = fetchProtoBytes(`/data/catalogue.${year}.pb`).then((bytes) =>
      fromProtoCatalogue(DataProto.Catalogue.decode(bytes)),
    );
    yearCataloguePromise.set(year, p);
  }
  return p;
}

function loadSchedules(termId: string): Promise<SchedulesData> {
  let p = schedulesPromise.get(termId);
  if (!p) {
    p = fetchProtoBytes(`/data/schedules.${termId}.pb`).then((bytes) =>
      fromProtoSchedulesData(DataProto.SchedulesData.decode(bytes)),
    );
    schedulesPromise.set(termId, p);
  }
  return p;
}

function optKeyFor(completedCourses: readonly string[]): string {
  const opt = completedCourses.map(normalizeCourseCode).filter(isOptCourse).sort();
  return opt.join(",");
}

function completedKey(completedCourses: readonly string[]): string {
  return [...completedCourses].map(normalizeCourseCode).sort().join(",");
}

function memoKey(dataKey: CacheDataKey): string {
  return `${dataKey.termId}|${dataKey.firstYear ?? "-"}|${completedKey(dataKey.completedCourses)}`;
}

/**
 * Fetches (with HTTP cache), decodes, merges, and builds a DataCache for the
 * given data key. Subsequent calls with the same key return the same cache
 * instance. Holds at most {@link MAX_CACHE_ENTRIES} entries (LRU on insertion).
 */
const MAX_CACHE_ENTRIES = 4;

export async function loadEffectiveCacheFromAssets(dataKey: CacheDataKey): Promise<DataCache> {
  const key = memoKey(dataKey);
  const hit = cacheMemo.get(key);
  if (hit) {
    // refresh LRU position
    cacheMemo.delete(key);
    cacheMemo.set(key, hit);
    return hit.cache;
  }

  const years = await loadManifestYears();
  const latestYear = years[0];
  if (latestYear === undefined) throw new Error("Catalogue manifest has no years");

  const [latestCatalogue, schedulesData, yearCatalogue] = await Promise.all([
    loadCatalogueForYear(latestYear),
    loadSchedules(dataKey.termId),
    dataKey.firstYear !== null ? loadYearCatalogue(dataKey.firstYear) : Promise.resolve(null),
  ]);

  const effectiveCatalogue =
    getMergedCatalogue(latestCatalogue, yearCatalogue?.courses ?? null, [
      ...dataKey.completedCourses,
    ]) ?? latestCatalogue;

  const cache = buildCacheWithOpt(effectiveCatalogue, schedulesData, dataKey.completedCourses);
  cacheMemo.set(key, {
    cache,
    catalogue: effectiveCatalogue,
    schedulesData,
    optKey: optKeyFor(dataKey.completedCourses),
  });
  while (cacheMemo.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cacheMemo.keys().next().value;
    if (oldestKey === undefined) break;
    cacheMemo.delete(oldestKey);
  }
  return cache;
}
