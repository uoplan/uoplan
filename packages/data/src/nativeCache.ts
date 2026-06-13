import { createFetchBytesTransport } from "./transport";
import type { FetchBytes, FetchResponse, ResolveUrl } from "./transport";

/**
 * Persistent byte cache backing the native ({@link createNativeCachingTransport})
 * transport. On device this is typically `expo-file-system`-backed; in tests it
 * is an in-memory map. Keys are opaque, filesystem-safe strings derived from a
 * resolved (content-hashed) asset URL.
 *
 * `get` MUST resolve to `null` rather than throwing when a key is absent or the
 * stored bytes are unreadable, so a corrupt cache entry degrades to a refetch
 * instead of failing the request.
 */
export interface CachedBytesStorage {
  get(this: void, key: string): Promise<Uint8Array | null>;
  set(this: void, key: string, bytes: Uint8Array): Promise<void>;
}

export interface NativeCachingTransportOptions {
  /**
   * Resolves an asset id (bare `.pb` filename) to its served URL. On native this
   * comes from a small runtime **manifest** the app fetches on launch and caches
   * (id → content-hashed URL); returning `undefined` marks the id unknown.
   */
  resolve: ResolveUrl;
  /**
   * Network fetch — the React Native global `fetch`, or a wrapper that ensures
   * brotli (`content-encoding: br`) `.pb` payloads are decompressed to raw
   * protobuf bytes before `arrayBuffer()` (RN's platform networking does not
   * always decode brotli, unlike gzip).
   */
  fetch(this: void, url: string): Promise<FetchResponse>;
  /** Persistent on-disk byte cache (e.g. an `expo-file-system` adapter). */
  storage: CachedBytesStorage;
  /** Prepended to every resolved URL (the deployment origin / CDN). */
  baseUrl?: string;
  /**
   * Derives the storage key for a resolved (already base-prefixed) URL. Defaults
   * to a filesystem-safe hash of the URL. Because asset URLs are content-hashed,
   * the URL itself is a stable, self-invalidating version key: a data change
   * yields a new URL (via the refreshed manifest) and therefore a fresh key.
   */
  cacheKey?: (url: string) => string;
  /**
   * When `true` (default), treat resolved URLs as immutable: serve cached bytes
   * without touching the network when present, and only fetch on a cache miss.
   * This is correct for content-hashed URLs and gives instant, offline-capable
   * launches after the first successful load. Set `false` to always revalidate
   * over the network and use the cache only as an offline fallback.
   */
  immutableUrls?: boolean;
  /** Invoked when a network failure is served from the on-disk cache instead. */
  onOfflineFallback?: (id: string, url: string, error: unknown) => void;
}

/**
 * FNV-1a (32-bit) hash → hex, suffixed with a sanitized URL tail for
 * debuggability. Deterministic and filesystem-safe; collisions are vanishingly
 * unlikely across the handful of `.pb` assets an app caches.
 */
function defaultCacheKey(url: string): string {
  let h = 0x811c_9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x0100_0193);
  }
  const hash = (h >>> 0).toString(16).padStart(8, "0");
  const tail = url.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(-48);
  return `${hash}-${tail}`;
}

/**
 * Native transport that fetches `.pb` assets over HTTP from the deployment
 * origin/CDN at runtime — assets are **not** bundled into the app binary, because
 * they change daily — and caches the bytes on disk so the app keeps working
 * **offline after the first successful load**.
 *
 * Resolution, base-URL prefixing and HTTP error messages match the web/worker
 * transports (it composes {@link createFetchBytesTransport} for the network leg).
 * The proto **format** is versioned with the app: if it changes, users update the
 * app; day-to-day **data** changes are picked up by re-fetching the manifest +
 * any newly content-hashed assets.
 */
export function createNativeCachingTransport(options: NativeCachingTransportOptions): FetchBytes {
  const {
    resolve,
    fetch: fetchUrl,
    storage,
    baseUrl = "",
    cacheKey = defaultCacheKey,
    immutableUrls = true,
    onOfflineFallback,
  } = options;

  const networkFetch = createFetchBytesTransport({ resolve, fetch: fetchUrl, baseUrl });

  return async (id) => {
    const resolved = resolve(id);
    if (resolved === undefined) throw new Error(`Unknown data asset: ${id}`);
    const url = `${baseUrl}${resolved}`;
    const key = cacheKey(url);

    if (immutableUrls) {
      const cached = await storage.get(key);
      if (cached) return cached;
    }

    try {
      const bytes = await networkFetch(id);
      try {
        await storage.set(key, bytes);
      } catch {
        // Best-effort cache write: a storage failure must not fail a live fetch.
      }
      return bytes;
    } catch (err) {
      const cached = await storage.get(key);
      if (cached) {
        onOfflineFallback?.(id, url, err);
        return cached;
      }
      throw err;
    }
  };
}
