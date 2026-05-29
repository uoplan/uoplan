import type { FetchBytes } from "./transport";

/**
 * Browser transport using the global `fetch`. `baseUrl` is prepended to every
 * path (default ""), so callers can target a CDN or a test origin.
 */
export function createFetchTransport(baseUrl = ""): FetchBytes {
  return async (path) => {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
