import { createNativeCachingTransport } from "@uoplan/data/nativeCache";
import type { FetchBytes } from "@uoplan/data/transport";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { fileSystemStorage, fileSystemTextCache } from "./file-system-storage";
import { loadDataAssetManifest, parseDataManifest } from "./manifest";
import type { DataAssetManifest } from "./manifest";

/** Production origin the app fetches `.pb` data from in release builds. */
const PROD_DATA_BASE_URL = "https://uoplan.party";

/**
 * Port the web app's Vite dev server listens on (`pnpm dev`). Defaults to Vite's
 * `5173`, but is overridable with `EXPO_PUBLIC_DEV_WEB_PORT` for when that port is
 * taken (e.g. another local project) and uoplan's dev server lands on `5174`.
 */
const DEV_WEB_PORT = process.env.EXPO_PUBLIC_DEV_WEB_PORT ?? "5173";

/**
 * Maps the Expo dev-server host to one the current platform can actually reach.
 * The Android emulator's loopback is the emulator itself, so the host machine
 * (where Vite runs) is only reachable via the special `10.0.2.2` alias;
 * `localhost`/`127.0.0.1` must be rewritten. iOS simulators and physical devices
 * (which report a LAN IP) reach the host as-is. Exported for unit testing.
 */
export function resolveDevDataHost(rawHost: string, platformOS: string): string {
  const host = rawHost.length > 0 ? rawHost : "localhost";
  if (platformOS === "android" && (host === "localhost" || host === "127.0.0.1")) {
    return "10.0.2.2";
  }
  return host;
}

/**
 * Resolves the dev web app's origin so a debug build fetches data from a running
 * `pnpm dev` instead of production. The Expo dev server's `hostUri` (e.g.
 * `192.168.1.5:8081` on a device, `127.0.0.1:8081` on a simulator) shares the
 * host with the Vite dev server — only the port differs — so we reuse the host
 * (mapped for reachability via {@link resolveDevDataHost}) and swap in
 * {@link DEV_WEB_PORT}. Returns `null` outside `__DEV__`.
 */
function devDataBaseUrl(): string | null {
  if (!__DEV__) return null;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    "";
  const host = resolveDevDataHost(hostUri.split(":")[0] ?? "", Platform.OS);
  return `http://${host}:${DEV_WEB_PORT}`;
}

/**
 * Origin the native app fetches `.pb` data from. Precedence:
 *
 * 1. `EXPO_PUBLIC_DATA_URL` — explicit override (any build).
 * 2. The dev web server (`http://<dev-host>:<EXPO_PUBLIC_DEV_WEB_PORT ?? 5173>`)
 *    in `__DEV__`.
 * 3. Production (`https://uoplan.party`).
 *
 * Assets change daily, so they are NOT bundled into the binary — they are fetched
 * at runtime and cached on disk for offline use.
 */
export const DATA_BASE_URL =
  process.env.EXPO_PUBLIC_DATA_URL ?? devDataBaseUrl() ?? PROD_DATA_BASE_URL;

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
 * Loads the build-time data-asset manifest (id → content-hashed `.pb` URL),
 * reusing the same offline text-cache + identity fetch as {@link
 * createDataTransport}. Exposed so the data provider can enumerate every
 * available asset id (schedule terms, catalogue years) to load them all up front.
 */
export function loadAssetManifest(baseUrl: string = DATA_BASE_URL): Promise<DataAssetManifest> {
  return loadDataAssetManifest({ baseUrl, cache: fileSystemTextCache, fetch: identityFetch });
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
 *
 * Implemented by composing {@link loadAssetManifest} (manifest fetch + offline
 * text cache) with {@link createTransportForManifest} (the per-manifest byte
 * transport), so the manifest is loaded once and lazily on first asset request.
 */
export function createDataTransport(baseUrl: string = DATA_BASE_URL): FetchBytes {
  let transportPromise: Promise<FetchBytes> | null = null;

  const ensureTransport = (): Promise<FetchBytes> => {
    transportPromise ??= loadAssetManifest(baseUrl)
      .then((manifest) => createTransportForManifest(manifest, baseUrl))
      .catch((err: unknown) => {
        transportPromise = null;
        throw err;
      });
    return transportPromise;
  };

  return async (id) => (await ensureTransport())(id);
}

/**
 * Builds a transport that resolves asset ids against a **specific** manifest
 * (rather than fetching the manifest itself). Used to (re)build the app from a
 * known manifest snapshot — e.g. the last known-good one during fallback — whose
 * content-hashed assets are already on disk, so it works offline.
 */
export function createTransportForManifest(
  manifest: DataAssetManifest,
  baseUrl: string = DATA_BASE_URL,
): FetchBytes {
  return createNativeCachingTransport({
    resolve: (id) => manifest[id],
    fetch: identityFetch,
    storage: fileSystemStorage,
    baseUrl,
    immutableUrls: true,
  });
}

/**
 * Storage key for the last manifest whose every asset decoded successfully. Kept
 * separate from {@link MANIFEST_CACHE_KEY} (the last *fetched* manifest) so a
 * fresh-but-undecodable dataset never clobbers the snapshot we can fall back to.
 */
const KNOWN_GOOD_MANIFEST_KEY = "data-manifest.known-good.json";

/** Reads the last known-good manifest snapshot, or `null` if there is none / it is unreadable. */
export async function readKnownGoodManifest(): Promise<DataAssetManifest | null> {
  const text = await fileSystemTextCache.read(KNOWN_GOOD_MANIFEST_KEY);
  if (text === null) return null;
  try {
    return parseDataManifest(text);
  } catch {
    return null;
  }
}

/** Persists a manifest as the new known-good snapshot. Best-effort: a write failure is swallowed. */
export async function writeKnownGoodManifest(manifest: DataAssetManifest): Promise<void> {
  try {
    await fileSystemTextCache.write(KNOWN_GOOD_MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // A storage failure must not break a successful load.
  }
}
