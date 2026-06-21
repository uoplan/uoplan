import type { NormalizedCourseCode } from "@uoplan/core/brand";
import type {
  Catalogue,
  CourseGradesData,
  Discipline,
  Faculty,
  SchedulesData,
} from "@uoplan/core/dataTypes";
import {
  buildSwapOptionView,
  difficultyBucket,
  findSwapCandidates,
  type SwapOptionView,
} from "@uoplan/core/generation/swapCandidates";
import type { ProfessorRatingsMap } from "@uoplan/core/professorRatings";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  buildGenerationConstraints,
  buildScheduleDataCache,
  firstYearCreditCapFor,
  type ScheduleVariant,
} from "@/lib/generate-schedule";
import type { ScheduleOptions } from "@/lib/schedule-options";

/** Sort orders offered in the swap section (mirrors the web swap list). */
export type SwapSortKey = "best" | "aplus" | "rating" | "alpha";

/** A swap candidate enriched with the data the swap section renders. */
export interface SwapOption extends SwapOptionView {
  /** Per-course satisfaction (1–5) from the feedback dataset, if known. */
  sentiment: number | null;
}

/** The decoded datasets needed to compute and render swap candidates. */
export interface SwapDataset {
  catalogue: Catalogue;
  disciplines: Discipline[];
  faculties: Faculty[];
  grades: CourseGradesData | null;
  ratings: ProfessorRatingsMap | null;
}

export interface ComputeSwapOptionsInput {
  dataset: SwapDataset;
  /** Raw term schedules (enriched internally to match the generator's cache). */
  schedules: SchedulesData;
  variant: ScheduleVariant;
  /** Course code of the clicked calendar event (the course to replace). */
  courseCode: string;
  options: ScheduleOptions;
  /** Courses pinned from the basket (never suggested as alternatives). */
  basketCodes: string[];
  /** Completed courses — drives prerequisite gating. */
  completedCourses?: string[];
  /** Per-course satisfaction map (1–5) for option metadata. */
  courseSentimentByNorm?: Map<NormalizedCourseCode, number> | null;
  /** Cap on the number of options returned (the catalogue is large). */
  limit?: number;
}

export interface SwapOptionsResult {
  /** Index of the clicked course in the variant's enrollments, or -1 if absent. */
  enrollmentIndex: number;
  options: SwapOption[];
}

/** Default ceiling on suggestions so the list stays responsive on device. */
const DEFAULT_LIMIT = 60;

/**
 * Compute the courses that could replace the clicked event while keeping every
 * other course in the variant at its current section, each enriched with the
 * grade / rating / satisfaction stats the swap section shows. Reuses the shared
 * {@link findSwapCandidates} + {@link buildSwapOptionView} core (the same logic
 * the web swap list runs), against the exact term cache the generator used.
 */
export function computeSwapOptions(input: ComputeSwapOptionsInput): SwapOptionsResult {
  const { dataset, variant, courseCode, options, basketCodes, completedCourses = [] } = input;
  const norm = normalizeCourseCode(courseCode);
  const enrollments = variant.schedule.enrollments;
  const enrollmentIndex = enrollments.findIndex((e) => e.courseCode === norm);
  if (enrollmentIndex < 0) return { enrollmentIndex: -1, options: [] };

  const { cache } = buildScheduleDataCache(
    dataset.catalogue,
    input.schedules,
    { disciplines: dataset.disciplines, faculties: dataset.faculties },
    dataset.grades,
  );
  const constraints = buildGenerationConstraints(
    options,
    dataset.ratings,
    firstYearCreditCapFor(options, completedCourses, cache),
  );

  const candidates = findSwapCandidates({
    cache,
    enrollments,
    enrollmentIndex,
    constraints,
    includeClosedComponents: options.includeClosedComponents,
    virtualSectionsOnly: options.virtualSectionsOnly,
    completedCourses,
    excludeCodes: basketCodes,
  });

  const sentimentMap = input.courseSentimentByNorm ?? null;
  const opts: SwapOption[] = candidates.map((code) => ({
    ...buildSwapOptionView(code, cache, dataset.ratings),
    sentiment: sentimentMap?.get(code) ?? null,
  }));

  // Default ordering: best rating, then A+ %, then alphabetical (the UI re-sorts).
  opts.sort(
    (a, b) =>
      (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
      (b.aPlusPercent ?? -1) - (a.aPlusPercent ?? -1) ||
      a.code.localeCompare(b.code),
  );

  const limit = input.limit ?? DEFAULT_LIMIT;
  return { enrollmentIndex, options: opts.slice(0, limit) };
}

export interface FilterSwapOptionsInput {
  query: string;
  /** Restrict to a difficulty bucket, or null for all. */
  difficulty: "easy" | "moderate" | "tough" | null;
  sort: SwapSortKey;
}

/**
 * Apply the swap section's search box, difficulty filter, and sort to the
 * computed options — the pure, testable core of the swap list rendering (mirrors
 * the web {@link SwapList}). Pure so it can be unit-tested without a renderer.
 */
export function filterSwapOptions(
  options: SwapOption[],
  { query, difficulty, sort }: FilterSwapOptionsInput,
): SwapOption[] {
  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => {
    const matchesQuery =
      !q || o.code.toLowerCase().includes(q) || (o.title ?? "").toLowerCase().includes(q);
    const matchesDifficulty =
      difficulty === null || (o.gpa != null && difficultyBucket(o.gpa) === difficulty);
    return matchesQuery && matchesDifficulty;
  });

  const byAlpha = (a: SwapOption, b: SwapOption) => a.code.localeCompare(b.code);
  const byDesc = (pick: (o: SwapOption) => number | null) => (a: SwapOption, b: SwapOption) => {
    const diff = (pick(b) ?? -1) - (pick(a) ?? -1);
    return diff !== 0 ? diff : byAlpha(a, b);
  };
  const comparator =
    sort === "aplus"
      ? byDesc((o) => o.aPlusPercent)
      : sort === "alpha"
        ? byAlpha
        : byDesc((o) => o.avgRating); // "best" and "rating" both rank by rating

  return [...filtered].sort(comparator);
}
