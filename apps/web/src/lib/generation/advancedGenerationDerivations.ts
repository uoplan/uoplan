import type { RemainingRequirement } from "@uoplan/core";

/** Minimal cache shape needed to resolve a course's credit value. */
export interface CourseCreditsLookup {
  getCourse(code: string): { credits?: number } | undefined;
}

interface PoolCourseOption {
  value: string;
  label: string;
}

/** Default credits assumed when a course is missing from the cache. */
const DEFAULT_CREDITS = 3;

/** Credits at or above this course-number threshold are NOT first-year. */
const FIRST_YEAR_COURSE_NUMBER_CEILING = 2000;

/** First-year credit total above which the program limit warning is shown. */
const FIRST_YEAR_CREDIT_WARN_THRESHOLD = 48;

/**
 * Build the selectable blacklist pool: every candidate course across the
 * remaining requirements that the student has not already completed, as
 * `{ value, label }` options sorted alphabetically by label.
 */
export function buildPoolCourseOptions(
  remainingRequirements: RemainingRequirement[],
  completedCourses: string[],
): PoolCourseOption[] {
  const completed = new Set(completedCourses);
  const codes = new Set(remainingRequirements.flatMap((r) => r.candidateCourses));
  return [...codes]
    .filter((code) => !completed.has(code))
    .map((code) => ({ value: code, label: code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Count distinct courses selected across all requirements. */
export function countUniqueSelected(selectedPerRequirement: Record<string, string[]>): number {
  return new Set(Object.values(selectedPerRequirement).flat()).size;
}

function firstYearCreditsForCode(code: string, cache: CourseCreditsLookup | null): number {
  const match = code.match(/\d{4}/);
  if (!match || Number(match[0]) >= FIRST_YEAR_COURSE_NUMBER_CEILING) return 0;
  return cache?.getCourse(code)?.credits ?? DEFAULT_CREDITS;
}

interface FirstYearCreditSummary {
  total: number;
  warn: boolean;
}

/**
 * Sum the first-year (course number < 2000) credits from completed courses plus
 * the not-yet-completed selected courses, and flag whether the total exceeds the
 * program's first-year credit ceiling.
 */
export function computeFirstYearCredits(
  cache: CourseCreditsLookup | null,
  completedCourses: string[],
  selectedPerRequirement: Record<string, string[]>,
): FirstYearCreditSummary {
  const completedCredits = completedCourses.reduce(
    (sum, code) => sum + firstYearCreditsForCode(code, cache),
    0,
  );
  const completed = new Set(completedCourses);
  const selectedCredits = [...new Set(Object.values(selectedPerRequirement).flat())]
    .filter((code) => !completed.has(code))
    .reduce((sum, code) => sum + firstYearCreditsForCode(code, cache), 0);
  const total = completedCredits + selectedCredits;
  return { total, warn: total > FIRST_YEAR_CREDIT_WARN_THRESHOLD };
}
