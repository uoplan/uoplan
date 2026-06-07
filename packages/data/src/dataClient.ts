import {
  type Catalogue,
  type Course,
  type DataCache,
  type SchedulesData,
  buildDataCache,
  enrichSchedulesDataWithGrades,
  getGradeLookups,
  getMergedCatalogue,
  isOptCourse,
  normalizeCourseCode,
  withExtraCourses,
} from "@uoplan/core";
import type { FetchBytes } from "./transport";
import { loadCatalogue, loadCatalogueManifest, loadGrades, loadSchedules } from "./loaders";

/**
 * Build a DataCache and inject fake entries for any OPT transfer-credit codes in
 * `completedCourses`, so both the main thread and the schedule worker build
 * identical caches from identical inputs.
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

export interface DataClientOptions {
  /** Underlying transport used to fetch raw `.pb` bytes. */
  transport: FetchBytes;
  /** Max number of effective DataCache entries to keep (LRU). Defaults to 4. */
  cacheSize?: number;
  /** Optional helper to merge the start-year catalogue into the latest one. */
  mergeCatalogue?: (
    latest: Catalogue,
    yearCourses: Course[] | null,
    completedCourses: string[],
  ) => Catalogue;
}

/**
 * Owns per-instance caches (no module-level singletons): a per-path in-flight/
 * resolved promise memo and an LRU of built {@link DataCache}s. Failed fetches
 * are NOT memoized, so a transient error can't permanently disable an asset.
 */
export interface DataClient {
  /** Memoized fetch of raw bytes (rejections evict the entry). */
  fetchBytes: FetchBytes;
  /** Fetch + decode + merge + build the DataCache for a data key. */
  loadEffectiveCache(dataKey: CacheDataKey): Promise<DataCache>;
  /**
   * Like {@link loadEffectiveCache} but also returns the merged catalogue and
   * schedules domain objects, so callers can re-encode them to proto bytes for
   * the WASM engine. Backed by the same LRU memo.
   */
  loadEffectiveDataset(dataKey: CacheDataKey): Promise<{
    cache: DataCache;
    catalogue: Catalogue;
    schedulesData: SchedulesData;
  }>;
  /** Drop all cached promises and built caches. */
  clear(): void;
}

interface MemoEntry {
  cache: DataCache;
  catalogue: Catalogue;
  schedulesData: SchedulesData;
}

function completedKey(completedCourses: readonly string[]): string {
  return [...completedCourses].map(normalizeCourseCode).sort().join(",");
}

function memoKey(dataKey: CacheDataKey): string {
  return `${dataKey.termId}|${dataKey.firstYear ?? "-"}|${completedKey(dataKey.completedCourses)}`;
}

export function createDataClient(options: DataClientOptions): DataClient {
  const { transport, cacheSize = 4, mergeCatalogue = getMergedCatalogue } = options;
  const bytesMemo = new Map<string, Promise<Uint8Array>>();
  const cacheMemo = new Map<string, MemoEntry>();

  const fetchBytes: FetchBytes = (path) => {
    const hit = bytesMemo.get(path);
    if (hit) return hit;
    const p = transport(path);
    bytesMemo.set(path, p);
    // Never memoize a rejection: a transient failure must not permanently
    // disable an asset for the lifetime of the client.
    p.catch(() => {
      if (bytesMemo.get(path) === p) bytesMemo.delete(path);
    });
    return p;
  };

  async function loadEffectiveDataset(dataKey: CacheDataKey): Promise<MemoEntry> {
    const key = memoKey(dataKey);
    const hit = cacheMemo.get(key);
    if (hit) {
      cacheMemo.delete(key);
      cacheMemo.set(key, hit);
      return hit;
    }

    const { years } = await loadCatalogueManifest(fetchBytes);
    const latestYear = years[0];
    if (latestYear === undefined) throw new Error("Catalogue manifest has no years");

    // When the student's first year is the same as the latest catalogue year, the
    // year-specific catalogue is byte-identical to the latest one. The fetch is
    // already de-duplicated by `fetchBytes`, but decoding a ~3 MB protobuf twice
    // is wasted main-thread work — reuse the decoded `latestCatalogue` instead.
    const needSeparateYearCatalogue =
      dataKey.firstYear !== null && dataKey.firstYear !== latestYear;

    const [latestCatalogue, rawSchedules, loadedYearCatalogue, grades] = await Promise.all([
      loadCatalogue(fetchBytes, latestYear),
      loadSchedules(fetchBytes, dataKey.termId),
      needSeparateYearCatalogue
        ? loadCatalogue(fetchBytes, dataKey.firstYear ?? latestYear)
        : Promise.resolve(null),
      loadGrades(fetchBytes).catch(() => null),
    ]);

    const yearCatalogue =
      dataKey.firstYear !== null && !needSeparateYearCatalogue
        ? latestCatalogue
        : loadedYearCatalogue;

    // Reconstruct per-section grade distributions at runtime from grades.pb
    // (these are no longer embedded in schedules.NNNN.pb). Grades are optional:
    // a missing/failed asset simply yields a cache without grade distributions.
    const schedulesData = grades
      ? enrichSchedulesDataWithGrades(rawSchedules, getGradeLookups(grades), Number(dataKey.termId))
      : rawSchedules;

    const effectiveCatalogue = mergeCatalogue(latestCatalogue, yearCatalogue?.courses ?? null, [
      ...dataKey.completedCourses,
    ]);

    const cache = buildCacheWithOpt(effectiveCatalogue, schedulesData, dataKey.completedCourses);
    const entry: MemoEntry = { cache, catalogue: effectiveCatalogue, schedulesData };
    cacheMemo.set(key, entry);
    while (cacheMemo.size > cacheSize) {
      const oldestKey = cacheMemo.keys().next().value;
      if (oldestKey === undefined) break;
      cacheMemo.delete(oldestKey);
    }
    return entry;
  }

  async function loadEffectiveCache(dataKey: CacheDataKey): Promise<DataCache> {
    return (await loadEffectiveDataset(dataKey)).cache;
  }

  function clear(): void {
    bytesMemo.clear();
    cacheMemo.clear();
  }

  return { fetchBytes, loadEffectiveCache, loadEffectiveDataset, clear };
}
