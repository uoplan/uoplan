import { createManifestTransport } from "@uoplan/data/browser";
import type { FetchBytes } from "@uoplan/data";

/**
 * Build the `id → served URL` map for every `.pb` data asset from Vite's
 * `import.meta.glob`. With `query: "?url"` + `eager`, Vite emits each asset as a
 * content-hashed file under `/assets/…` (build) or serves it from source (dev)
 * and inlines the resolved URL here, so the browser never hard-codes a path.
 */
const urlModules = import.meta.glob("../assets/data/*.pb", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const urlById: Record<string, string> = {};
for (const [sourcePath, url] of Object.entries(urlModules)) {
  urlById[sourcePath.slice(sourcePath.lastIndexOf("/") + 1)] = url;
}

/** Resolve a `.pb` asset id (bare filename) to the URL Vite serves it from. */
function resolveDataUrl(id: string): string | undefined {
  return urlById[id];
}

/** Browser transport: resolves ids to hashed URLs and fetches their bytes. */
export const dataTransport: FetchBytes = createManifestTransport(resolveDataUrl);
