import {
  buildDataCache,
  enrichSchedulesDataWithGrades,
  getGradeLookups,
  getMergedCatalogue,
  isOptCourse,
  normalizeCourseCode,
  reconstructCatalogueForYear,
  withExtraCourses,
} from "@uoplan/core";
import type { Catalogue, Course, DataCache, DisciplinesData, SchedulesData } from "@uoplan/core";
import type { FetchBytes } from "./transport";
import {
  loadCatalogueManifest,
  loadCataloguePrereqHistory,
  loadCatalogueUnionProto,
  loadGrades,
  loadSchedules,
} from "./loaders";

/**
 * Build a DataCache and inject fake entries for any OPT transfer-credit codes in
 * `completedCourses`, so both the main thread and the schedule worker build
 * identical caches from identical inputs.
 */
export function buildCacheWithOpt(
  catalogue: Catalogue,
  schedulesData: SchedulesData,
  completedCourses: readonly string[],
  disciplinesData?: DisciplinesData,
): DataCache {
  const base = buildDataCache(catalogue, schedulesData, disciplinesData);
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
  /** Memoized fetch of raw bytes by asset id (rejections evict the entry). */
  fetchBytes: FetchBytes;
  /**
   * Fetch an asset by id and decode it with `type.decode`, memoizing the decoded
   * message so repeat callers reuse it. Failed fetches/decodes are not memoized.
   * The caller is responsible for always pairing an id with the same proto type.
   */
  load<T>(type: ProtoDecoder<T>, id: string): Promise<T>;
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

/** A protobuf message type that can decode bytes into `T` (e.g. `DataProto.TermsData`). */
export interface ProtoDecoder<T> {
  decode(bytes: Uint8Array): T;
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
  const decodedMemo = new Map<string, Promise<unknown>>();
  const cacheMemo = new Map<string, MemoEntry>();

  const fetchBytes: FetchBytes = (id) => {
    const hit = bytesMemo.get(id);
    if (hit) return hit;
    let p!: Promise<Uint8Array>;
    p = (async () => {
      try {
        return await transport(id);
      } catch (err) {
        if (bytesMemo.get(id) === p) bytesMemo.delete(id);
        throw err;
      }
    })();
    bytesMemo.set(id, p);
    return p;
  };

  function load<T>(type: ProtoDecoder<T>, id: string): Promise<T> {
    const hit = decodedMemo.get(id);
    if (hit) return hit as Promise<T>;
    let p!: Promise<T>;
    p = (async () => {
      try {
        const bytes = await fetchBytes(id);
        return type.decode(bytes);
      } catch (err) {
        if (decodedMemo.get(id) === p) decodedMemo.delete(id);
        throw err;
      }
    })();
    decodedMemo.set(id, p);
    return p;
  }

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

    // Cohort prerequisites now come from a tiny history overlay applied to the
    // single union catalogue, instead of fetching a second full year catalogue.
    const needCohortPrereqs = dataKey.firstYear !== null && dataKey.firstYear !== latestYear;

    const [unionProto, rawSchedules, history, grades] = await Promise.all([
      loadCatalogueUnionProto(fetchBytes),
      loadSchedules(fetchBytes, dataKey.termId),
      needCohortPrereqs ? loadCataloguePrereqHistory(fetchBytes) : Promise.resolve(null),
      loadGrades(fetchBytes).catch(() => null),
    ]);

    const unionCatalogue = reconstructCatalogueForYear(unionProto, null, latestYear);
    const yearCourses = needCohortPrereqs
      ? reconstructCatalogueForYear(unionProto, history, dataKey.firstYear ?? latestYear).courses
      : null;

    // Reconstruct per-section grade distributions at runtime from grades.pb
    // (these are no longer embedded in schedules.NNNN.pb). Grades are optional:
    // a missing/failed asset simply yields a cache without grade distributions.
    const schedulesData = grades
      ? enrichSchedulesDataWithGrades(rawSchedules, getGradeLookups(grades), Number(dataKey.termId))
      : rawSchedules;

    const effectiveCatalogue = mergeCatalogue(unionCatalogue, yearCourses, [
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
    decodedMemo.clear();
    cacheMemo.clear();
  }

  return { fetchBytes, load, loadEffectiveCache, loadEffectiveDataset, clear };
}
