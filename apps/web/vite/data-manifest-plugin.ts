import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDataManifestModule } from "@uoplan/data/codegen";
import type { DataManifest } from "@uoplan/data/codegen";
import type { Plugin } from "vite";

/**
 * Emits the generated data manifest consumed by the Cloudflare worker.
 *
 * The browser resolves `.pb` asset ids via `import.meta.glob('?url')`, but the
 * worker is bundled separately and can't see Vite's glob. After the client
 * build hashes every `src/assets/data/*.pb` into `dist/client/assets/`, this
 * plugin records the resulting `id → /assets/<hash>.pb` map into
 * `packages/data/src/generated/dataManifest.ts`, which the worker statically
 * imports (see packages/data/src/worker.ts). A placeholder is scaffolded by
 * `pnpm build:data-proto` so typecheck/dev always have the module.
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
  for (const name of originalNames) {
    const normalized = name.replaceAll("\\", "/");
    if (normalized.includes("/assets/data/") && normalized.endsWith(".pb")) {
      ids.push(path.posix.basename(normalized));
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
    },
  };
}
