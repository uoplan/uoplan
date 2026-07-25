import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SCHOOL_ID, isSchoolId } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

/** Files that mark a directory as holding one school's scraped dataset. */
const DATA_MARKERS = ["terms.json", join("catalogue", "catalogue.json")];

function hasDataMarkers(dir: string): boolean {
  return DATA_MARKERS.some((marker) => existsSync(join(dir, marker)));
}

/**
 * The school directories present under a checked-out `data` branch's
 * `apps/scraper/data`.
 *
 * Three layouts exist in the wild:
 *   - **namespaced** (target) — one directory per school, `uottawa/`,
 *     `carleton/`, … Every school found is returned.
 *   - **flat** (legacy, pre-multi-school) — `catalogue/`, `terms.json` and
 *     friends sitting directly at the root with no school directory. Those
 *     belong to the default school, so the root itself is returned under
 *     {@link DEFAULT_SCHOOL_ID}.
 *   - **mixed** — a newly added school has been scraped into its own directory
 *     while the default school's files are still flat at the root, because each
 *     school's scrape migrates only its own data. This is the *normal* state
 *     between the first scrape of a new school and the next scrape of the
 *     default one, so it must keep both.
 *
 * Supporting all three means a data branch that hasn't been migrated yet still
 * builds, so the migration doesn't have to be atomic with the code deploy.
 * Treating "any school directory exists" as "fully namespaced" would silently
 * drop the default school from every build for as long as the mixed state lasts.
 */
export function discoverSchoolSources(sourceRoot: string): [SchoolId, string][] {
  const found = new Map<SchoolId, string>(
    readdirSync(sourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isSchoolId(entry.name))
      .map((entry): [SchoolId, string] => [entry.name as SchoolId, join(sourceRoot, entry.name)]),
  );

  // Only when the default school has no directory of its own: once it has been
  // migrated, the namespaced copy is authoritative and any root leftovers are
  // stale. The marker check keeps stray files from inventing a phantom source.
  if (!found.has(DEFAULT_SCHOOL_ID) && hasDataMarkers(sourceRoot)) {
    found.set(DEFAULT_SCHOOL_ID, sourceRoot);
  }

  if (found.size === 0) return [[DEFAULT_SCHOOL_ID, sourceRoot]];

  return [...found].sort(([a], [b]) => a.localeCompare(b));
}
