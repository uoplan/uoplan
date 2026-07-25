/**
 * Compile the source JSON datasets to runtime `.pb` assets for every school.
 *
 * The proto build itself is single-school (`build:proto -- --school=<id>`)
 * because each school's assets are namespaced independently. Production builds
 * need all of them, so this drives one invocation per school that actually has
 * data on disk.
 *
 * Schools without local data are skipped rather than failing: a contributor who
 * only hydrated uOttawa should still get a working build, and `fetch-data.ts`
 * already reports what it hydrated.
 *
 * Env:
 *   - DATA_SCHOOLS   comma-separated school ids to limit the build to.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSchoolId, SCHOOL_IDS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = join(repoRoot, "apps", "scraper", "data");

function requestedSchools(): readonly SchoolId[] {
  const raw = process.env.DATA_SCHOOLS?.trim();
  if (!raw) return SCHOOL_IDS;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = ids.filter((id) => !isSchoolId(id));
  if (invalid.length > 0) {
    throw new Error(
      `build-data-proto: DATA_SCHOOLS has unknown school ids: ${invalid.join(", ")}.`,
    );
  }
  return ids as SchoolId[];
}

function hasData(school: SchoolId): boolean {
  return existsSync(join(DATA_ROOT, school, "catalogue", "catalogue.json"));
}

const schools = requestedSchools();
const buildable = schools.filter(hasData);

if (buildable.length === 0) {
  throw new Error(
    `build-data-proto: no source data found for ${schools.join(", ")} under apps/scraper/data. ` +
      "Run `pnpm data:fetch` (or FORCE_DATA_FETCH=1 pnpm data:fetch) first.",
  );
}

for (const school of schools) {
  if (!hasData(school)) {
    console.log(`build-data-proto: no local data for ${school} - skip.`);
    continue;
  }
  console.log(`build-data-proto: building ${school} ...`);
  execFileSync("pnpm", ["--filter", "scraper", "build:proto", "--", `--school=${school}`], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
