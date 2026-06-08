import { createFetchBytesTransport, type FetchBytes } from "./transport";
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
  return createFetchBytesTransport({
    resolve: (id) => (id.startsWith("/") ? id : (dataManifest[id] ?? `/data/${id}`)),
    fetch: (url) => assets.fetch(new Request(url)),
    baseUrl: origin,
  });
}
