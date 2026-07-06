import type * as DataProto from "@uoplan/proto/data";
import { createExtraCodeAccumulator } from "@uoplan/core/dataTypes/codeRef";
import { mapPrereq, mapRequirement } from "./catalogue.ts";
import type {
  CatalogueCourseInput,
  CatalogueJsonInput,
  CatalogueProgramInput,
  CodeRefEncoder,
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

/** Program identity key, matching {@link mapCatalogue}'s `program_key`. */
function programKeyOf(program: CatalogueProgramInput): string {
  return program.slug ?? program.url ?? program.title ?? "";
}

/** Stable value-signature of a program (title + requirements), used to detect
 * per-cohort drift vs the union baseline and to collapse identical years. */
function programSignature(program: CatalogueProgramInput): string {
  return JSON.stringify({
    title: program.title ?? "",
    requirements: program.requirements ?? [],
  });
}

/**
 * Builds the per-cohort program-history overlay: the programs analogue of
 * {@link buildPrereqHistory}. The union `Catalogue` already ships the LATEST
 * year's programs; this overlay lets earlier cohorts be reconstructed without a
 * full programs-only catalogue per year (each of which re-shipped a large
 * course-code dictionary, ~1 MB gzip aggregate across years).
 *
 * A program present in every tracked year with the union (latest) value has no
 * overlay at all. Otherwise the overlay records, per program key, a bitmask of
 * the years it matched the baseline plus any distinct non-baseline values (each
 * with the set of years using it). Program-requirement code refs index the
 * union `Catalogue.course_codes`; the few program-only codes absent from it go
 * into this overlay's shared `extra_codes` (referenced past
 * `unionCourseCodes.length`, mirroring `Catalogue.extra_codes`). See @uoplan/core
 * reconstructProgramsForYear.
 *
 * `yearInputs` MUST be sorted ascending by year and align with `unionInput`.
 */
export function buildProgramHistory(
  yearInputs: readonly YearCatalogue[],
  unionInput: CatalogueJsonInput,
  unionCourseCodes: readonly string[],
): DataProto.CatalogueProgramHistory {
  const years = yearInputs.map((y) => y.year);
  const yearBit = new Map(years.map((y, i) => [y, 1 << i]));
  const codeIndex = new Map(unionCourseCodes.map((c, i) => [c, i]));

  // Shared accumulator: program-requirement codes absent from the union
  // course_codes dictionary go into the overlay's extra_codes, referenced past
  // `unionCourseCodes.length` (mirrors Catalogue.extra_codes).
  const extra = createExtraCodeAccumulator();
  const encodeCodeRef: CodeRefEncoder = (code) => {
    const normalized = normalizeCode(code ?? "");
    if (!normalized) return;
    return extra.resolve(normalized, codeIndex.get(normalized), unionCourseCodes.length);
  };

  // Baseline = the union (latest-seen) value per program key; a year matching it
  // is recorded only as a bit in `baseline_present_mask`, never restated.
  const baseline = new Map<string, string>();
  for (const program of unionInput.programs ?? []) {
    baseline.set(programKeyOf(program), programSignature(program));
  }

  const baselineMask = new Map<string, number>();
  // key → (signature → { yearMask, sample program carrying that value })
  const perKey = new Map<string, Map<string, { mask: number; program: CatalogueProgramInput }>>();
  const keyOrder: string[] = [];
  const seen = new Set<string>();

  for (const { year, data } of yearInputs) {
    const bit = yearBit.get(year) ?? 0;
    for (const program of data.programs ?? []) {
      const key = programKeyOf(program);
      if (!seen.has(key)) {
        seen.add(key);
        keyOrder.push(key);
      }
      const sig = programSignature(program);
      if (sig === baseline.get(key)) {
        baselineMask.set(key, (baselineMask.get(key) ?? 0) | bit);
        continue;
      }
      let bySig = perKey.get(key);
      if (!bySig) {
        bySig = new Map();
        perKey.set(key, bySig);
      }
      const existing = bySig.get(sig);
      if (existing) existing.mask |= bit;
      else bySig.set(sig, { mask: bit, program });
    }
  }

  const allYearsMask = years.length >= 32 ? 0xffffffff : (1 << years.length) - 1;
  const overlays: DataProto.ProgramOverlay[] = [];
  for (const key of keyOrder) {
    const presentMask = baselineMask.get(key) ?? 0;
    const bySig = perKey.get(key);
    const revisions: DataProto.ProgramRevision[] = bySig
      ? [...bySig.values()].map(({ mask, program }) => ({
          yearMask: mask,
          program: {
            title: program.title ?? "",
            programKey: key,
            requirements: (program.requirements ?? []).map((req) =>
              mapRequirement(req, encodeCodeRef),
            ),
          },
        }))
      : [];
    // Fully-stable union program (present every year with the baseline value):
    // reconstructed straight from the union, so no overlay is needed.
    if (baseline.has(key) && presentMask === allYearsMask && revisions.length === 0) continue;
    overlays.push({ programKey: key, baselinePresentMask: presentMask, revisions });
  }

  return { years, overlays, extraCodes: extra.extraCodes };
}
