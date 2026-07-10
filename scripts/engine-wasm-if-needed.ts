/**
 * Stamp-based engine WASM build for the local dev loop.
 * Usage: node scripts/engine-wasm-if-needed.ts [--dev]
 * Force: FORCE_ENGINE_WASM=1 node scripts/engine-wasm-if-needed.ts
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { allExist, hashPaths } from "./stamp-utils.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const isDev = args.includes("--dev");
const FORCE = process.env.FORCE_ENGINE_WASM === "1" || process.env.FORCE_ENGINE_WASM === "true";

const INPUT_PATHS = [
  "packages/engine/src",
  "packages/engine/Cargo.toml",
  "packages/engine/Cargo.lock",
  "packages/engine/build.rs",
  "packages/engine/.cargo",
  "packages/proto/proto/engine.proto",
  "packages/proto/proto/data.proto",
];

const OUTPUT = "packages/engine/pkg/uoplan_engine.js";

function main(): void {
  const stampDir = join(repoRoot, ".cache");
  mkdirSync(stampDir, { recursive: true });
  const stamp = join(stampDir, isDev ? "engine-wasm.dev.stamp" : "engine-wasm.release.stamp");
  const digest = hashPaths(repoRoot, INPUT_PATHS, isDev ? "dev" : "release");
  const prev = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";

  if (!FORCE && prev === digest && allExist(repoRoot, [OUTPUT])) {
    console.log("engine-wasm: up to date (stamp match) - skip");
    return;
  }

  if (FORCE) console.log("engine-wasm: forced");
  else if (prev !== digest) console.log("engine-wasm: inputs changed - building");
  else console.log("engine-wasm: output missing - building");

  const shArgs = isDev
    ? ["scripts/build-engine-wasm.sh", "--dev"]
    : ["scripts/build-engine-wasm.sh"];
  execFileSync("bash", shArgs, { cwd: repoRoot, stdio: "inherit" });
  writeFileSync(stamp, `${digest}\n`);
  console.log("engine-wasm: done");
}

main();
