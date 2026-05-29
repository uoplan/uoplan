import type { CacheDataKey } from "@uoplan/data";
import type { DataCache } from "@uoplan/core";
import { dataClient } from "./dataClient";

export { buildCacheWithOpt } from "@uoplan/data";
export type { CacheDataKey } from "@uoplan/data";

/**
 * Fetch, decode, merge, and build the effective DataCache for a data key using
 * the shared browser data client (instance-owned LRU + per-path byte memo).
 * Shared between the main-thread store and the schedule worker so both build
 * identical caches from identical inputs.
 */
export function loadEffectiveCacheFromAssets(dataKey: CacheDataKey): Promise<DataCache> {
  return dataClient.loadEffectiveCache(dataKey);
}
