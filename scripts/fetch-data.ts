/**
 * Hydrate apps/scraper/data/<school> from the dedicated `data` branch.
 *
 * The large JSON datasets live on an orphan-ish `data` branch (off `main`) so
 * they don't bloat `main`'s clone size or line-count. Builds shallow-fetch the
 * latest datasets for every school into apps/scraper/data before proto
 * compilation.
 *
 * Two branch layouts are accepted:
 *   - **namespaced** (current) — `apps/scraper/data/<school>/…`, one directory
 *     per school. Every school found is hydrated.
 *   - **flat** (legacy, pre-multi-school) — `apps/scraper/data/catalogue/…`
 *     with no school directory. Mapped onto the default school, so a data
 *     branch that hasn't been migrated yet still builds.
 *
 * Behaviour:
 *   - No-op when every school the branch offers already has local JSON and
 *     FORCE_DATA_FETCH is unset. This covers offline use and any checkout that
 *     still ships the data.
 *   - The gitignored `raw/` dir inside each school is left untouched.
 *
 * Env:
 *   - FORCE_DATA_FETCH=1   always fetch, overwriting local JSON.
 *   - DATA_FETCH_REMOTE    git remote/URL to clone (default: origin's URL).
 *   - DATA_BRANCH          branch to fetch (default: data).
 *   - DATA_SCHOOLS         comma-separated school ids to limit the fetch to.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isSchoolId } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";
import { discoverSchoolSources } from "../apps/scraper/src/shared/dataBranchLayout.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = join(repoRoot, "apps", "scraper", "data");
const CACHE_DIR = join(repoRoot, ".cache", "data-branch");
const BRANCH = process.env.DATA_BRANCH ?? "data";
const FORCE = process.env.FORCE_DATA_FETCH === "1" || process.env.FORCE_DATA_FETCH === "true";

/** Marker files that indicate a populated dataset for one school. */
const MARKERS = ["terms.json", join("catalogue", "catalogue.json")];

/** Explicit school allow-list from the environment, or `null` for "all". */
function requestedSchools(): ReadonlySet<SchoolId> | null {
  const raw = process.env.DATA_SCHOOLS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = ids.filter((id) => !isSchoolId(id));
  if (invalid.length > 0) {
    throw new Error(`fetch-data: DATA_SCHOOLS has unknown school ids: ${invalid.join(", ")}.`);
  }
  return new Set(ids as SchoolId[]);
}

function hasLocalData(school: SchoolId): boolean {
  return MARKERS.some((m) => existsSync(join(DATA_ROOT, school, m)));
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

function copySchool(source: string, school: SchoolId): void {
  const dest = join(DATA_ROOT, school);
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, {
    recursive: true,
    filter: (src) => basename(src) !== ".git" && !src.includes(`${sep}.git${sep}`),
  });
}

function main(): void {
  const only = requestedSchools();

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

  const sourceRoot = join(CACHE_DIR, "apps", "scraper", "data");
  if (!existsSync(sourceRoot)) {
    throw new Error(
      `fetch-data: '${BRANCH}' branch is missing apps/scraper/data (unexpected layout).`,
    );
  }

  const sources = discoverSchoolSources(sourceRoot).filter(
    ([school]) => only === null || only.has(school),
  );
  if (sources.length === 0) {
    throw new Error(`fetch-data: '${BRANCH}' branch has no data for the requested schools.`);
  }

  for (const [school, source] of sources) {
    if (!FORCE && hasLocalData(school)) {
      console.log(
        `fetch-data: local apps/scraper/data/${school} present - skip (set FORCE_DATA_FETCH=1 to refresh).`,
      );
      continue;
    }
    copySchool(source, school);
    console.log(`fetch-data: apps/scraper/data/${school} hydrated from the data branch.`);
  }
}

/**
 * Skip the network entirely when every school already has local data. Cloning
 * is the expensive part, so this check has to happen before `main` runs.
 */
function everySchoolAlreadyLocal(): boolean {
  const only = requestedSchools();
  const local = readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isSchoolId(e.name))
    .map((e) => e.name as SchoolId)
    .filter((school) => only === null || only.has(school));
  return local.length > 0 && local.every(hasLocalData);
}

if (!FORCE && existsSync(DATA_ROOT) && everySchoolAlreadyLocal()) {
  console.log(
    "fetch-data: local apps/scraper/data present - skip (FORCE_DATA_FETCH=1 to refresh).",
  );
} else {
  main();
}
