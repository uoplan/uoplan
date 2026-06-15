import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_MANIFEST_PATH } from "@uoplan/data/transport";
import type { Plugin } from "vite";

/**
 * Serves the data assets over the **dev** server so the native apps (and any
 * non-browser client) can fetch real data from a running `pnpm dev` without a
 * production deploy.
 *
 * In a production build, `data-manifest-plugin.ts` emits a static
 * `data/manifest.json` mapping each id to its content-hashed `/assets/<hash>.pb`
 * URL. The dev server doesn't content-hash or run that build hook, so this plugin
 * mirrors the same contract at dev time:
 *
 * - `GET {DATA_MANIFEST_PATH}` → `{ "<id>.pb": "/data/<id>.pb", … }` for every
 *   `.pb` under `apps/web/src/assets/data`.
 * - `GET /data/<id>.pb` → the raw bytes of that source asset (octet-stream,
 *   uncompressed — Vite dev doesn't brotli, so the native client reads it
 *   directly).
 *
 * The native app points at the dev server's origin in `__DEV__`, so the manifest
 * + asset URLs resolve against `http://<dev-host>:5173`.
 */
function dataAssetsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/vite → apps/web/src/assets/data
  return path.resolve(here, "..", "src", "assets", "data");
}

function listAssetIds(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".pb"))
      .sort();
  } catch {
    return [];
  }
}

export function dataDevServerPlugin(): Plugin {
  return {
    name: "data-dev-server",
    apply: "serve",
    configureServer(server) {
      const dir = dataAssetsDir();

      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        const pathname = rawUrl.split("?")[0];

        if (pathname === DATA_MANIFEST_PATH) {
          const manifest: Record<string, string> = {};
          for (const id of listAssetIds(dir)) manifest[id] = `/data/${id}`;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(`${JSON.stringify(manifest, null, 2)}\n`);
          return;
        }

        if (pathname.startsWith("/data/") && pathname.endsWith(".pb")) {
          const id = path.posix.basename(pathname);
          const file = path.join(dir, id);
          // Guard against path traversal: the resolved file must stay in `dir`.
          if (path.dirname(file) === dir && fs.existsSync(file)) {
            res.setHeader("content-type", "application/octet-stream");
            res.setHeader("cache-control", "no-store");
            res.end(fs.readFileSync(file));
            return;
          }
        }

        next();
      });
    },
  };
}
