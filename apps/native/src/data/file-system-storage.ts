import { Directory, File, Paths } from "expo-file-system";

import type { CachedBytesStorage } from "@uoplan/data/nativeCache";

import type { TextCache } from "./manifest";

/** Sub-directory of the app cache where `.pb` byte blobs are persisted. */
const CACHE_DIR_NAME = "uoplan-data";

/**
 * Resolves (creating if needed) the cache directory that backs the byte store.
 * Lives under `Paths.cache` because the OS may reclaim it under storage
 * pressure — exactly the right semantics for a re-fetchable data cache.
 */
function ensureCacheDir(): Directory {
  const dir = new Directory(Paths.cache, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/**
 * `expo-file-system`-backed {@link CachedBytesStorage} for the native data
 * transport. Each cache key (a filesystem-safe hash derived from the resolved,
 * content-addressed asset URL) maps to one file of raw protobuf bytes.
 *
 * `get` resolves to `null` — never throws — on a miss or unreadable entry, so a
 * corrupt cache degrades to a refetch rather than failing the request. Writes
 * are best-effort; a failed write must not break a live fetch (the caller in
 * `createNativeCachingTransport` already swallows write errors).
 */
export const fileSystemStorage: CachedBytesStorage = {
  async get(key) {
    try {
      const file = new File(ensureCacheDir(), key);
      if (!file.exists) return null;
      return await file.bytes();
    } catch {
      return null;
    }
  },

  async set(key, bytes) {
    const file = new File(ensureCacheDir(), key);
    // `write` creates the file when absent and overwrites it otherwise.
    file.write(bytes);
  },
};

/**
 * `expo-file-system`-backed {@link TextCache} for the small data-asset manifest
 * (`data/manifest.json`). Stored as text in the same cache directory; `read`
 * resolves to `null` — never throws — on a miss or unreadable entry so a missing
 * manifest degrades to a network fetch.
 */
export const fileSystemTextCache: TextCache = {
  async read(key) {
    try {
      const file = new File(ensureCacheDir(), key);
      if (!file.exists) return null;
      return await file.text();
    } catch {
      return null;
    }
  },

  async write(key, value) {
    const file = new File(ensureCacheDir(), key);
    file.write(value);
  },
};
