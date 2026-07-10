/**
 * Stamp-based generate gate for the local dev loop.
 * Usage: node scripts/generate-if-needed.ts
 * Force: FORCE_GENERATE=1 node scripts/generate-if-needed.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allExist, hashPaths } from "./stamp-utils.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = process.env.FORCE_GENERATE === "1" || process.env.FORCE_GENERATE === "true";

const INPUT_PATHS = [
  "packages/proto/proto",
  "packages/proto/package.json",
  "packages/i18n/src/locales",
  "packages/i18n/lingui.config.ts",
  "packages/i18n/package.json",
  "apps/scraper/data",
  "apps/scraper/src/proto",
  "apps/scraper/src/cli",
  "apps/scraper/package.json",
  "package.json",
];

const OUTPUT_MARKERS = [
  "packages/proto/src/generated/data.ts",
  "packages/i18n/src/locales/en/messages.ts",
  "apps/web/src/assets/data/catalogue.union.pb",
  "apps/web/src/assets/data/terms.pb",
];

function main(): void {
  const stampDir = join(repoRoot, ".cache");
  mkdirSync(stampDir, { recursive: true });
  const stamp = join(stampDir, "generate.stamp");
  const digest = hashPaths(repoRoot, INPUT_PATHS);
  const prev = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";

  if (!FORCE && prev === digest && allExist(repoRoot, OUTPUT_MARKERS)) {
    console.log("generate: up to date (stamp match) - skip");
    return;
  }

  if (FORCE) console.log("generate: forced");
  else if (prev !== digest) console.log("generate: inputs changed - running");
  else console.log("generate: outputs missing - running");

  execFileSync("pnpm", ["generate"], { cwd: repoRoot, stdio: "inherit" });
  writeFileSync(stamp, `${digest}\n`);
  console.log("generate: done");
}

main();
