import { createNativeCachingTransport } from "@uoplan/data/nativeCache";
import type { FetchBytes } from "@uoplan/data/transport";

import { fileSystemStorage, fileSystemTextCache } from "./file-system-storage";
import { loadDataAssetManifest } from "./manifest";
import type { DataAssetManifest } from "./manifest";

/**
 * Default deployment origin the native app fetches `.pb` data from. The assets
 * change daily, so they are NOT bundled into the binary — they are fetched at
 * runtime, directly from the CDN, and cached on disk for offline use.
 */
export const DATA_BASE_URL = "https://uoplan.party";

/**
 * Forces the CDN to serve assets **uncompressed**. Cloudflare brotli-encodes
 * `.pb`/JSON by default, which React Native's networking does not reliably
 * decode; requesting `identity` makes the edge return raw bytes the client can
 * read directly — which is what lets the app skip the worker proxy entirely.
 */
const IDENTITY_HEADERS = { "Accept-Encoding": "identity" } as const;

function identityFetch(url: string): Promise<Response> {
  return fetch(url, { headers: IDENTITY_HEADERS });
}

/**
 * Builds the native data transport. On first use it fetches the build-time data
 * manifest the web app publishes (`/data/manifest.json`, id → content-hashed
 * `.pb` URL), then downloads each asset **directly** from its content-hashed CDN
 * URL — there is no worker proxy serving the static data.
 *
 * The manifest is revalidated on every launch (its contents change as data is
 * rebuilt) and cached for offline use; the `.pb` URLs it points at are
 * content-hashed, so they are treated as immutable (`immutableUrls: true`): once
 * downloaded they are served from disk without touching the network, giving
 * instant, offline-capable launches. A data change yields a new manifest with new
 * hashed URLs, which are then fetched fresh. If the proto **format** changes,
 * users update the app; day-to-day **data** changes need no update.
 */
export function createDataTransport(baseUrl: string = DATA_BASE_URL): FetchBytes {
  let manifest: DataAssetManifest | null = null;
  let manifestPromise: Promise<DataAssetManifest> | null = null;

  const ensureManifest = (): Promise<DataAssetManifest> => {
    if (manifest) return Promise.resolve(manifest);
    manifestPromise ??= loadDataAssetManifest({
      baseUrl,
      cache: fileSystemTextCache,
      fetch: identityFetch,
    })
      .then((loaded) => {
        manifest = loaded;
        return loaded;
      })
      .catch((err: unknown) => {
        manifestPromise = null;
        throw err;
      });
    return manifestPromise;
  };

  const fetchAsset = createNativeCachingTransport({
    resolve: (id) => manifest?.[id],
    fetch: identityFetch,
    storage: fileSystemStorage,
    baseUrl,
    immutableUrls: true,
  });

  return async (id) => {
    await ensureManifest();
    return fetchAsset(id);
  };
}
