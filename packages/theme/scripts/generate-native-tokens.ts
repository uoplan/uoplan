/**
 * CLI: (re)write the committed `src/nativeTokens.gen.ts` from the web
 * token source. All colour logic lives in the platform-agnostic `src/tokenGen`;
 * this thin wrapper is the only place that touches the filesystem.
 *
 * Usage:
 *   pnpm --filter @uoplan/theme generate:tokens          # write the file
 *   pnpm --filter @uoplan/theme generate:tokens --check  # CI drift guard
 *
 * (Node >= 23 runs this `.ts` directly via type-stripping.)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateNativeTokens, renderModule, THEME_IDS } from "../src/tokenGen.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = resolve(here, "../../../apps/web/src/styles/tokens.css");
const OUT_FILE = resolve(here, "../src/nativeTokens.gen.ts");

const css = readFileSync(TOKENS_CSS, "utf8");
const next = renderModule(generateNativeTokens(css));

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT_FILE, "utf8");
  if (current !== next) {
    console.error(
      `Drift: ${OUT_FILE} is stale.\n` +
        "Run `pnpm --filter @uoplan/theme generate:tokens` after editing tokens.css.",
    );
    process.exit(1);
  }
  console.log(`nativeTokens.gen.ts is up to date (${THEME_IDS.length} themes).`);
} else {
  writeFileSync(OUT_FILE, next, "utf8");
  console.log(`Wrote ${OUT_FILE} (${THEME_IDS.length} themes).`);
}
