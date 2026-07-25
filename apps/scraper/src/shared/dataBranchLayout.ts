import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_SCHOOL_ID, isSchoolId } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

/**
 * The school directories present under a checked-out `data` branch's
 * `apps/scraper/data`.
 *
 * Two layouts exist in the wild:
 *   - **namespaced** (current) — one directory per school, `uottawa/`,
 *     `carleton/`, … Every school found is returned.
 *   - **flat** (legacy, pre-multi-school) — `catalogue/`, `terms.json` and
 *     friends sitting directly at the root with no school directory. Those
 *     belong to the default school, so the root itself is returned under
 *     {@link DEFAULT_SCHOOL_ID}.
 *
 * Supporting both means a data branch that hasn't been migrated yet still
 * builds, so the migration doesn't have to be atomic with the code deploy.
 */
export function discoverSchoolSources(sourceRoot: string): [SchoolId, string][] {
  const namespaced = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSchoolId(entry.name))
    .map((entry): [SchoolId, string] => [entry.name as SchoolId, join(sourceRoot, entry.name)])
    .sort(([a], [b]) => a.localeCompare(b));

  if (namespaced.length > 0) return namespaced;
  return [[DEFAULT_SCHOOL_ID, sourceRoot]];
}
