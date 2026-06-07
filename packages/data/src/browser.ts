import type { FetchBytes, ResolveUrl } from "./transport";

/**
 * Browser transport using the global `fetch`. Asset ids are resolved to their
 * content-hashed URL by `resolve` (built from Vite's `import.meta.glob` in the
 * web app); `baseUrl` is prepended to every resolved URL (default ""), so callers
 * can target a CDN or a test origin.
 */
export function createManifestTransport(resolve: ResolveUrl, baseUrl = ""): FetchBytes {
  return async (id) => {
    const url = resolve(id);
    if (url === undefined) throw new Error(`Unknown data asset: ${id}`);
    const res = await fetch(`${baseUrl}${url}`);
    if (!res.ok) throw new Error(`Failed to load ${id} (${url}): HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
