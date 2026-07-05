import type * as DataProto from "@uoplan/proto/data";
import { mapPrereq } from "./catalogue.ts";
import type {
  CatalogueCourseInput,
  CatalogueJsonInput,
  CatalogueProgramInput,
} from "./catalogue.ts";
import { normalizeCode } from "./shared.ts";

/** One parsed year catalogue, tagged with its calendar year. */
export interface YearCatalogue {
  year: number;
  data: CatalogueJsonInput;
}

/** Stable value-signature of a course's prerequisite state (tree + text presence). */
function prereqSignature(course: CatalogueCourseInput): string {
  return JSON.stringify({
    prerequisites: course.prerequisites ?? null,
    hasPrereqText: Boolean(course.prereqText),
  });
}

/**
 * Union of every course seen across all years, keeping the **latest** metadata
 * per course (later years overwrite earlier ones), plus the **latest** year's
 * programs. This is the single course payload the app ships; per-cohort
 * prerequisite differences are carried separately by {@link buildPrereqHistory}
 * and cohort programs by the small per-year programs-only assets.
 *
 * `yearInputs` MUST be sorted ascending by year.
 */
export function buildUnionCatalogueInput(yearInputs: readonly YearCatalogue[]): CatalogueJsonInput {
  const byCode = new Map<string, CatalogueCourseInput>();
  let latestPrograms: CatalogueProgramInput[] = [];
  for (const { data } of yearInputs) {
    for (const course of data.courses ?? []) {
      byCode.set(normalizeCode(course.code ?? ""), course);
    }
    if (data.programs && data.programs.length > 0) latestPrograms = data.programs;
  }
  return { courses: [...byCode.values()], programs: latestPrograms };
}

/**
 * Builds the per-course prerequisite history overlay. For each course whose
 * prerequisites in some non-latest year differ from the union (latest) baseline,
 * records the distinct prerequisite values and, via a year bitmask, which years
 * used each. Reconstructs any cohort's prerequisites and powers a per-course
 * changelog. `unionCourseCodes` is the union `Catalogue.course_codes` dictionary
 * the overlay indexes into (see @uoplan/core reconstructCatalogueForYear).
 *
 * `yearInputs` MUST be sorted ascending by year and align with `unionInput`.
 */
export function buildPrereqHistory(
  yearInputs: readonly YearCatalogue[],
  unionInput: CatalogueJsonInput,
  unionCourseCodes: readonly string[],
): DataProto.CataloguePrereqHistory {
  const years = yearInputs.map((y) => y.year);
  const yearBit = new Map(years.map((y, i) => [y, 1 << i]));
  const codeIndex = new Map(unionCourseCodes.map((c, i) => [c, i]));

  // Baseline = the union (latest-seen) prereq value per course; the year that
  // matches it is skipped, so a course with stable prereqs produces no overlay.
  const baseline = new Map<string, string>();
  for (const course of unionInput.courses ?? []) {
    baseline.set(normalizeCode(course.code ?? ""), prereqSignature(course));
  }

  // code → (signature → { yearMask, sample course carrying that prereq value })
  const perCode = new Map<string, Map<string, { mask: number; course: CatalogueCourseInput }>>();
  for (const { year, data } of yearInputs) {
    const bit = yearBit.get(year) ?? 0;
    for (const course of data.courses ?? []) {
      const code = normalizeCode(course.code ?? "");
      const sig = prereqSignature(course);
      if (sig === baseline.get(code)) continue;
      let bySig = perCode.get(code);
      if (!bySig) {
        bySig = new Map();
        perCode.set(code, bySig);
      }
      const existing = bySig.get(sig);
      if (existing) existing.mask |= bit;
      else bySig.set(sig, { mask: bit, course });
    }
  }

  const overlays: DataProto.CoursePrereqOverlay[] = [];
  for (const [code, bySig] of perCode) {
    const index = codeIndex.get(code);
    if (index === undefined) continue;
    const revisions: DataProto.PrereqRevision[] = [...bySig.values()].map(({ mask, course }) => ({
      yearMask: mask,
      prerequisites: course.prerequisites ? mapPrereq(course.prerequisites) : undefined,
      hasPrereqText: Boolean(course.prereqText),
    }));
    overlays.push({ code: index, revisions });
  }
  overlays.sort((a, b) => a.code - b.code);

  return { years, overlays };
}

/** A programs-only catalogue input for one cohort year (courses stripped — they
 * come from the union). Program requirement code-refs still resolve via the
 * catalogue encoder's `extra_codes` fallback. */
export function programsOnlyInput(data: CatalogueJsonInput): CatalogueJsonInput {
  return { courses: [], programs: data.programs ?? [] };
}
