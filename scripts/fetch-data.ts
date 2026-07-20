/**
 * Hydrate apps/scraper/data from the dedicated `data` branch.
 *
 * The large JSON datasets live on an orphan-ish `data` branch (off `main`) so
 * they don't bloat `main`'s clone size or line-count. Builds shallow-fetch the
 * latest datasets into apps/scraper/data before proto compilation.
 *
 * Behaviour:
 *   - No-op when apps/scraper/data already carries JSON and FORCE_DATA_FETCH is
 *     unset. This covers offline use and any checkout that still ships the data.
 *   - Otherwise a shallow single-branch clone of `data` is copied into
 *     apps/scraper/data (the gitignored raw/ dir is left untouched). The `data`
 *     branch preserves the apps/scraper/data/** layout, so paths are identical
 *     on both branches.
 *
 * Env:
 *   - FORCE_DATA_FETCH=1   always fetch, overwriting local JSON.
 *   - DATA_FETCH_REMOTE    git remote/URL to clone (default: origin's URL).
 *   - DATA_BRANCH          branch to fetch (default: data).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(repoRoot, "apps", "scraper", "data");
const CACHE_DIR = join(repoRoot, ".cache", "data-branch");
const BRANCH = process.env.DATA_BRANCH ?? "data";
const FORCE = process.env.FORCE_DATA_FETCH === "1" || process.env.FORCE_DATA_FETCH === "true";

/** Marker files that indicate a populated local dataset. */
const MARKERS = ["terms.json", join("catalogue", "catalogue.json")];

function hasLocalData(): boolean {
  return MARKERS.some((m) => existsSync(join(DATA_DIR, m)));
}

function git(args: string[], cwd = repoRoot): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function resolveRemote(): string {
  if (process.env.DATA_FETCH_REMOTE) return process.env.DATA_FETCH_REMOTE;
  try {
    return git(["remote", "get-url", "origin"]);
  } catch {
    throw new Error("fetch-data: no DATA_FETCH_REMOTE set and no `origin` remote to clone from.");
  }
}

function main(): void {
  if (!FORCE && hasLocalData()) {
    console.log(
      "fetch-data: local apps/scraper/data present - skip (set FORCE_DATA_FETCH=1 to refresh).",
    );
    return;
  }

  const remote = resolveRemote();
  console.log(`fetch-data: cloning '${BRANCH}' from ${remote} ...`);
  rmSync(CACHE_DIR, { recursive: true, force: true });
  mkdirSync(dirname(CACHE_DIR), { recursive: true });
  git([
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--single-branch",
    "--branch",
    BRANCH,
    remote,
    CACHE_DIR,
  ]);

  mkdirSync(DATA_DIR, { recursive: true });
  const source = join(CACHE_DIR, "apps", "scraper", "data");
  if (!existsSync(source)) {
    throw new Error(
      `fetch-data: '${BRANCH}' branch is missing apps/scraper/data (unexpected layout).`,
    );
  }
  cpSync(source, DATA_DIR, {
    recursive: true,
    filter: (src) => basename(src) !== ".git" && !src.includes(`${sep}.git${sep}`),
  });
  console.log("fetch-data: apps/scraper/data hydrated from the data branch.");
}

main();
