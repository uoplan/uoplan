/**
 * Fails if newly staged/committed source files exceed a size budget.
 * Intended as a pre-commit guard for accidental bulk data dumps.
 *
 * Usage: node scripts/check-bulk-files.ts [paths...]
 * Default: scan staged files via git when no paths given.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Soft warning threshold (bytes). */
const WARN_BYTES = 2 * 1024 * 1024;
/** Hard fail for non-data paths. */
const FAIL_BYTES = 5 * 1024 * 1024;
/** Data paths under apps/scraper/data are allowed up to this (already large). */
const DATA_FAIL_BYTES = 50 * 1024 * 1024;

function isDataPath(rel: string): boolean {
  return rel.replaceAll("\\", "/").startsWith("apps/scraper/data/");
}

function listPaths(argv: string[]): string[] {
  if (argv.length > 0) return argv;
  try {
    const out = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=AM"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function main(): void {
  const paths = listPaths(process.argv.slice(2));
  let failed = false;
  for (const rel of paths) {
    const full = join(repoRoot, rel);
    if (!existsSync(full)) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const limit = isDataPath(rel) ? DATA_FAIL_BYTES : FAIL_BYTES;
    if (st.size > limit) {
      console.error(
        `✗ ${rel}: ${(st.size / (1024 * 1024)).toFixed(1)} MiB exceeds ${(limit / (1024 * 1024)).toFixed(0)} MiB limit`,
      );
      failed = true;
    } else if (st.size > WARN_BYTES) {
      console.warn(
        `! ${rel}: ${(st.size / (1024 * 1024)).toFixed(1)} MiB (large; ok if intentional data)`,
      );
    }
  }
  if (failed) process.exit(1);
  if (paths.length === 0) console.log("check-bulk-files: no paths to check");
  else console.log(`check-bulk-files: ok (${paths.length} path(s))`);
}

main();
