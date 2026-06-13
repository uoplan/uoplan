// @ts-nocheck
/**
 * Generates `src/data/changelog.generated.ts` from the repo-root CHANGELOG.md.
 *
 * Metro can't import a `.md` file as text out of the box, and the web app uses a
 * Vite virtual module for the same source, so the native app gets a committed,
 * regenerated TS module instead. Run via `pnpm --filter native gen:changelog`
 * (also wired as a `predev`/`prebuild`-style step). Keep the output committed so
 * typecheck/CI don't depend on running this first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../CHANGELOG.md");
const out = resolve(here, "../src/data/changelog.generated.ts");

const md = readFileSync(source, "utf8");
// Escape for a template literal: backslash, backtick, and `${`.
const escaped = md.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const banner =
  "// AUTO-GENERATED from the repo-root CHANGELOG.md by scripts/generate-changelog.mjs.\n" +
  "// Do not edit by hand — run `pnpm --filter native gen:changelog`.\n";

writeFileSync(out, `${banner}export const CHANGELOG_MD = \`${escaped}\`;\n`, "utf8");
console.log(`Wrote ${out} (${md.length} bytes of changelog)`);
