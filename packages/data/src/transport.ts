/**
 * A transport fetches the raw bytes of a `.pb` data asset by its **id**. An id is
 * the asset's path relative to the data root, which is namespaced by school:
 * `uottawa/catalogue.pb`, `carleton/schedules.202630.pb`. Callers normally hold a
 * bare, school-neutral id (`catalogue.pb`) and let {@link withAssetNamespace}
 * prefix it once for the active school.
 *
 * Implementations decide how an id maps to a real location and where the bytes
 * come from: the browser resolves it to a content-hashed `/assets/…` URL and
 * uses `fetch`; the Cloudflare worker resolves it via the generated manifest and
 * uses `env.ASSETS.fetch`; node/tests read it straight off the filesystem. A
 * transport MUST reject (throw) on failure; callers that treat an asset as
 * optional wrap the call with {@link optional}.
 */
export type FetchBytes = (id: string) => Promise<Uint8Array>;

/** Resolves an asset id to the URL it is served from, or `undefined` if unknown. */
export type ResolveUrl = (id: string) => string | undefined;

/**
 * Stable, **unhashed** URL path of the build-time data-asset manifest the web
 * build publishes as a static file (see `apps/web/vite/data-manifest-plugin.ts`).
 * It maps every `.pb` asset id (its bare filename) to that asset's content-hashed
 * URL. The native apps fetch this on launch to resolve assets and download them
 * directly from the CDN — there is no worker proxy. Because it is not hashed, its
 * URL is stable; its *contents* change as data is rebuilt, so clients must
 * revalidate it (it is the only non-immutable data fetch).
 */
export const DATA_MANIFEST_PATH = "/data/manifest.json";

export interface FetchResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface FetchBytesTransportOptions {
  resolve: ResolveUrl;
  fetch(this: void, url: string): Promise<FetchResponse>;
  baseUrl?: string;
}

export function createFetchBytesTransport({
  resolve,
  fetch: fetchUrl,
  baseUrl = "",
}: FetchBytesTransportOptions): FetchBytes {
  return async (id) => {
    const url = resolve(id);
    if (url === undefined) throw new Error(`Unknown data asset: ${id}`);
    const res = await fetchUrl(`${baseUrl}${url}`);
    if (!res.ok) throw new Error(`Failed to load ${id} (${url}): HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}

/** Resolve to `null` instead of rejecting when an optional asset is missing. */
export async function optional(fetchBytes: FetchBytes, id: string): Promise<Uint8Array | null> {
  try {
    return await fetchBytes(id);
  } catch {
    return null;
  }
}

/**
 * Scope a transport to one school's asset namespace.
 *
 * Every `.pb` asset is published under a per-school directory
 * (`uottawa/catalogue.pb`, `carleton/catalogue.pb`), but the loaders in
 * `loaders.ts` and every caller downstream keep using bare, school-neutral ids
 * (`catalogue.pb`). Wrapping the transport once — at the point where the app
 * knows which school it is running as — is what keeps that indirection out of
 * the ~30 loader signatures.
 *
 * Ids that are already namespaced (they contain a `/`) pass through untouched,
 * so callers holding a fully-qualified id are not double-prefixed.
 */
export function withAssetNamespace(fetchBytes: FetchBytes, namespace: string): FetchBytes {
  return (id) => fetchBytes(id.includes("/") ? id : `${namespace}/${id}`);
}
