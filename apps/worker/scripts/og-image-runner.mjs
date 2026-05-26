#!/usr/bin/env node
// Bundles og-image.ts with esbuild (handles CJS/ESM interop) then runs it.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outfile = "/tmp/og-image-bundle.mjs";

// Resolve the worker package root so og-image.ts can find its node_modules
const workerRoot = join(__dirname, "..");

await build({
  entryPoints: [join(__dirname, "og-image.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  // Inject the worker root path so WASM lookup works regardless of bundle location
  define: { WORKER_ROOT: JSON.stringify(workerRoot) },
  external: ["node:*"],
  logLevel: "warning",
});

const result = spawnSync("node", [outfile, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
