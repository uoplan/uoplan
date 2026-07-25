import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDataManifestModule } from "@uoplan/data/codegen";
import type { DataManifest } from "@uoplan/data/codegen";
import { DATA_MANIFEST_PATH } from "@uoplan/data/transport";
import type { Plugin } from "vite";

/**
 * Emits the generated data manifest in two forms:
 *
 * 1. A static `data/manifest.json` file published with the client bundle (served
 *    at {@link DATA_MANIFEST_PATH}). This is the **native apps'** source of truth:
 *    they fetch it on launch (it is not content-hashed, so its URL is stable) and
 *    download each `.pb` asset directly from its content-hashed URL — there is no
 *    worker proxy.
 * 2. A `packages/data/src/generated/dataManifest.ts` module the Cloudflare worker
 *    statically imports to resolve ids when generating OG images in-process (see
 *    `packages/data/src/worker.ts`).
 *
 * The browser itself resolves `.pb` asset ids via `import.meta.glob('?url')`, but
 * neither the worker nor the native client can see Vite's glob. After the client
 * build hashes every `src/assets/data/*.pb` into `dist/client/assets/`, this
 * plugin records the resulting `id → /assets/<hash>.pb` map into both outputs. A
 * placeholder module is scaffolded by `pnpm build:data-proto` so typecheck/dev
 * always have it.
 */
function generatedManifestPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/vite → monorepo root → packages/data/src/generated/dataManifest.ts
  return path.join(
    here,
    "..",
    "..",
    "..",
    "packages",
    "data",
    "src",
    "generated",
    "dataManifest.ts",
  );
}

function assetIdsFromSource(originalNames: readonly string[]): string[] {
  const ids: string[] = [];
  const root = "/assets/data/";
  for (const name of originalNames) {
    const normalized = name.replaceAll("\\", "/");
    const index = normalized.indexOf(root);
    // The id is the path *below* `assets/data`, so the per-school directory
    // (`uottawa/`, `carleton/`) is part of it.
    if (index !== -1 && normalized.endsWith(".pb")) {
      ids.push(normalized.slice(index + root.length));
    }
  }
  return ids;
}

export function dataManifestPlugin(): Plugin {
  return {
    name: "data-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      // With the Cloudflare plugin this hook also fires for the worker
      // environment, whose bundle has no `.pb` assets. Only the client build
      // carries them, so skip other environments to avoid clobbering the
      // manifest with an empty map.
      const envName = this.environment?.name;
      if (envName && envName !== "client") return;

      const manifest: DataManifest = {};
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "asset") continue;
        // Rollup ≥4 exposes `originalFileNames` (array); older builds used the
        // singular `originalFileName`. A single output asset can back several
        // source files (identical content is deduped), so map every source id.
        const originalNames = [
          ...(chunk.originalFileNames ?? []),
          ...((chunk as { originalFileName?: string }).originalFileName
            ? [(chunk as { originalFileName?: string }).originalFileName as string]
            : []),
        ];
        for (const id of assetIdsFromSource(originalNames)) {
          manifest[id] = `/${chunk.fileName}`;
        }
      }

      const target = generatedManifestPath();
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, renderDataManifestModule(manifest));
      this.info(`wrote data manifest with ${Object.keys(manifest).length} entries → ${target}`);

      // Publish the same map as a static JSON file in the client bundle so the
      // native apps can fetch it directly (id → content-hashed `.pb` URL) and
      // download assets straight from the CDN — no worker proxy. Keys are sorted
      // for a reproducible artifact. `fileName` (not `name`) keeps it unhashed so
      // its URL is the stable, well-known `DATA_MANIFEST_PATH`.
      const sorted: DataManifest = {};
      for (const id of Object.keys(manifest).sort()) sorted[id] = manifest[id];
      this.emitFile({
        type: "asset",
        fileName: DATA_MANIFEST_PATH.replace(/^\//, ""),
        source: `${JSON.stringify(sorted, null, 2)}\n`,
      });
    },
  };
}
