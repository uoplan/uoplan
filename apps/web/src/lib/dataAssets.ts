import { createManifestTransport } from "@uoplan/data/browser";
import { dataAssetUrlById } from "./dataAssetIndex";
import type { FetchBytes } from "@uoplan/data";

/** Resolve a `.pb` asset id (`<school>/<name>.pb`) to the URL Vite serves it from. */
function resolveDataUrl(id: string): string | undefined {
  return dataAssetUrlById[id];
}

/** Browser transport: resolves ids to hashed URLs and fetches their bytes. */
export const dataTransport: FetchBytes = createManifestTransport(resolveDataUrl);
