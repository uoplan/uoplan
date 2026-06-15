import { getMergedCatalogue as mergeCatalogue } from "@uoplan/core";
import type { Catalogue, Course } from "@uoplan/core";

/**
 * Merges the latest catalogue with the start-year catalogue when the user selects
 * their first year of study. Latest provides course metadata and new courses;
 * start-year prerequisites override for every overlapping code (empty year prereqs
 * strip latest prereqs). Completed courses that exist in the year catalogue keep
 * the full year row (credits/level). Alias→canonical mapping is applied and
 * superseded alias rows are removed.
 *
 * Null-tolerant wrapper around {@link mergeCatalogue} (`@uoplan/core`).
 */
export function getMergedCatalogue(
  catalogue: Catalogue | null,
  yearCatalogueCourses: Course[] | null,
  completedCourses: string[],
): Catalogue | null {
  if (!catalogue) return null;
  return mergeCatalogue(catalogue, yearCatalogueCourses, completedCourses);
}

let effectiveMemoInputs: readonly [Catalogue | null, Course[] | null, string[]] | null = null;
let effectiveMemoResult: Catalogue | null = null;

/**
 * Identity-memoized {@link getMergedCatalogue}. Returns the same merged catalogue
 * reference while its inputs are unchanged, so callers that build the WASM engine
 * from it (synchronous swap paths, in-process generation fallback) get a stable
 * object the engine memo can key on instead of rebuilding the engine each call.
 * This is the catalogue the store's `cache` is built from, so the engine sees the
 * same year-merged prerequisites/credits as response mapping.
 */
export function getEffectiveCatalogue(
  catalogue: Catalogue | null,
  yearCatalogueCourses: Course[] | null,
  completedCourses: string[],
): Catalogue | null {
  if (
    effectiveMemoInputs &&
    effectiveMemoInputs[0] === catalogue &&
    effectiveMemoInputs[1] === yearCatalogueCourses &&
    effectiveMemoInputs[2] === completedCourses
  ) {
    return effectiveMemoResult;
  }
  effectiveMemoResult = getMergedCatalogue(catalogue, yearCatalogueCourses, completedCourses);
  effectiveMemoInputs = [catalogue, yearCatalogueCourses, completedCourses];
  return effectiveMemoResult;
}
