import { getSchool } from "@uoplan/domain/school";
import type { School, SchoolFeatures } from "@uoplan/domain/school";
import { getActiveSchool } from "../lib/activeSchool";

/**
 * The active school's registry entry.
 *
 * The active school is frozen for the document's lifetime (see
 * `lib/activeSchool.ts`), so this is intentionally not reactive — switching
 * schools reloads the page.
 */
export function useSchool(): School {
  return getSchool(getActiveSchool());
}

/**
 * Whether the active school has a given capability.
 *
 * Use this to gate whole features rather than checking the school id directly:
 * `useSchoolFeature("grades")` states *why* something is hidden, and adding a
 * third school then only means filling in its feature table.
 */
export function useSchoolFeature(feature: keyof SchoolFeatures): boolean {
  return getSchool(getActiveSchool()).features[feature];
}
