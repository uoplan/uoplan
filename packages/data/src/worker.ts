import type { FetchBytes } from "./transport";

/** Minimal shape of a Cloudflare `Fetcher` (e.g. `env.ASSETS`). */
export interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

/**
 * Cloudflare worker transport using a bound asset `Fetcher`. `origin` is the
 * request origin used to build absolute asset URLs.
 */
export function createAssetsTransport(assets: AssetsFetcher, origin: string): FetchBytes {
  return async (path) => {
    const res = await assets.fetch(new Request(`${origin}${path}`));
    if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
