/**
 * A transport fetches the raw bytes of a `.pb` asset by its public path
 * (e.g. `/data/catalogue.pb`). Implementations decide where bytes come from:
 * `fetch` in the browser, `env.ASSETS.fetch` in the Cloudflare worker, or the
 * filesystem in node/tests. A transport MUST reject (throw) on failure; callers
 * that treat an asset as optional wrap the call with {@link optional}.
 */
export type FetchBytes = (path: string) => Promise<Uint8Array>;

/** Resolve to `null` instead of rejecting when an optional asset is missing. */
export async function optional(fetchBytes: FetchBytes, path: string): Promise<Uint8Array | null> {
  try {
    return await fetchBytes(path);
  } catch {
    return null;
  }
}
