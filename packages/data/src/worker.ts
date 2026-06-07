import type { FetchBytes } from "./transport";
import { dataManifest } from "./generated/dataManifest";

/** Minimal shape of a Cloudflare `Fetcher` (e.g. `env.ASSETS`). */
export interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

/**
 * Cloudflare worker transport using a bound asset `Fetcher`. Asset ids are
 * resolved to their content-hashed `/assets/…` URL via the generated
 * {@link dataManifest} (written by the web Vite build); `origin` is the request
 * origin used to build the absolute URL handed to the `Fetcher`.
 */
export function createAssetsTransport(assets: AssetsFetcher, origin: string): FetchBytes {
  return async (id) => {
    // Ids that are already absolute paths (e.g. `/fonts/…`) are served verbatim;
    // bare `.pb` asset ids are resolved to their hashed URL via the manifest.
    const url = id.startsWith("/") ? id : (dataManifest[id] ?? `/data/${id}`);
    const res = await assets.fetch(new Request(`${origin}${url}`));
    if (!res.ok) throw new Error(`Failed to load ${id} (${url}): HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
