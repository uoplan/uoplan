/**
 * A transport fetches the raw bytes of a `.pb` data asset by its **id** — the
 * bare filename of the asset (e.g. `catalogue.pb`, `schedules.2265.pb`).
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
