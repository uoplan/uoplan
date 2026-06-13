import { DATA_MANIFEST_PATH } from "@uoplan/data/transport";

/**
 * Map of `.pb` asset id (its bare filename, e.g. `terms.pb`) → the content-hashed
 * URL it is served from (e.g. `/assets/terms-CEaC0eCQ.pb`). This is exactly the
 * shape of the static `data/manifest.json` the web build publishes (see
 * `apps/web/vite/data-manifest-plugin.ts`).
 */
export type DataAssetManifest = Record<string, string>;

/**
 * Tiny string cache used to persist the fetched manifest text for offline use.
 * On device this is backed by `expo-file-system`; tests inject an in-memory map.
 * `read` MUST resolve to `null` (never throw) on a miss or unreadable entry.
 */
export interface TextCache {
  read(this: void, key: string): Promise<string | null>;
  write(this: void, key: string, value: string): Promise<void>;
}

/** Minimal response contract the manifest loader needs from `fetch`. */
export interface ManifestFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface LoadDataManifestOptions {
  /** Deployment origin/CDN the manifest (and assets) are served from. */
  baseUrl: string;
  /** Persistent text cache for the last good manifest (offline fallback). */
  cache: TextCache;
  /** Network fetch (the RN global `fetch`, ideally with identity encoding). */
  fetch(this: void, url: string): Promise<ManifestFetchResponse>;
}

/** Storage key for the cached manifest text. */
export const MANIFEST_CACHE_KEY = "data-manifest.json";

/**
 * Parses the published manifest JSON into a {@link DataAssetManifest}, keeping
 * only string-valued entries and rejecting anything that is not a JSON object
 * (e.g. the SPA `index.html` served when the manifest is absent).
 */
export function parseDataManifest(text: string): DataAssetManifest {
  const raw: unknown = JSON.parse(text);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid data manifest: expected a JSON object");
  }
  const manifest: DataAssetManifest = {};
  for (const [id, url] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof url === "string") manifest[id] = url;
  }
  return manifest;
}

/**
 * Fetches the build-time data-asset manifest published by the web app and caches
 * its text for offline use. The manifest is **not** content-hashed (its contents
 * change as data is rebuilt), so it is revalidated over the network on every
 * launch; when the network fails, the last good cached manifest is used so the
 * app still resolves the assets it already downloaded.
 */
export async function loadDataAssetManifest(
  options: LoadDataManifestOptions,
): Promise<DataAssetManifest> {
  const { baseUrl, cache, fetch: fetchUrl } = options;
  const url = `${baseUrl}${DATA_MANIFEST_PATH}`;
  try {
    const res = await fetchUrl(url);
    if (!res.ok) throw new Error(`Failed to load data manifest (${url}): HTTP ${res.status}`);
    const text = await res.text();
    const manifest = parseDataManifest(text);
    try {
      await cache.write(MANIFEST_CACHE_KEY, text);
    } catch {
      // Best-effort cache write: a storage failure must not fail a live fetch.
    }
    return manifest;
  } catch (err) {
    const cached = await cache.read(MANIFEST_CACHE_KEY);
    if (cached !== null) return parseDataManifest(cached);
    throw err;
  }
}
