import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import type { CourseFilters } from "@uoplan/domain/courseFilters";
import { courseMatchesFilters } from "@uoplan/domain/courseFilters";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { Course } from "@uoplan/domain/dataTypes";
import {
  aggregateCourseDistribution,
  courseAPlusPercent,
  distributionGpa,
  normalizeGradeVizDistribution,
} from "@uoplan/grades/gradeDistribution";
import type { GradeVizData } from "@uoplan/grades/gradeDistribution";
import { isWithinElectiveLevelBuckets } from "../poolHelpers";
import { buildPrereqContext } from "@uoplan/requirements/prerequisites/context";
import { canTakeCourse } from "@uoplan/requirements/prerequisites/evaluator";
import type { PrereqContext } from "@uoplan/requirements/prerequisites/types";
import type { ProfessorRatingsMap } from "@uoplan/professors/professorRatings";
import { getRatingsForInstructors } from "@uoplan/professors/professorRatings";
import { getEffectiveSchedule } from "../scheduleFilters";
import { isHonoursProject, normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { enrollmentsOverlap } from "./overlaps";
import { getEnrollmentsForCourse, getValidSectionCombos } from "./sectionCombos";
import type { CourseEnrollment, GenerationConstraints } from "./types";

/** Difficulty bucket for a course, derived from its mean GPA (0–10). */
export type SwapDifficulty = "easy" | "moderate" | "tough";

/**
 * Difficulty bucket from a course's mean GPA. Shared by the web swap list and
 * the native swap section so both classify courses identically (and matching the
 * Explore difficulty thresholds).
 */
export function difficultyBucket(gpa: number): SwapDifficulty {
  if (gpa >= 9) return "easy";
  if (gpa >= 7.5) return "moderate";
  return "tough";
}

/** Inputs to {@link findSwapCandidates}. */
export interface FindSwapCandidatesInput {
  cache: DataCache;
  /** The current schedule's enrollments. */
  enrollments: CourseEnrollment[];
  /** Index into `enrollments` of the course being replaced. */
  enrollmentIndex: number;
  /** Time / rating constraints applied to each candidate's section combos. */
  constraints: GenerationConstraints;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  /** Completed courses — drives prerequisite gating (empty ⇒ only no-prereq courses). */
  completedCourses?: string[];
  /** Student programs for the prerequisite context. */
  studentPrograms?: string[];
  /** Course codes that must never be suggested (e.g. basket + completed). */
  excludeCodes?: Iterable<string>;
  /** Optional Explore-style level / language filters. */
  filters?: CourseFilters;
  /** Optional elective level-bucket restriction (empty ⇒ default cap). */
  electiveLevelBuckets?: number[];
  /** Lowercase course prefixes to exclude (e.g. excluded categories). */
  excludedPrefixes?: string[];
  /**
   * Reused combo cache keyed `${code}:${includeClosed}:${virtualOnly}` so repeated
   * lookups (e.g. across several open/close cycles) stay cheap.
   */
  comboCache?: Map<string, CourseEnrollment[]>;
}

/**
 * Find courses that could replace the enrollment at `enrollmentIndex` while
 * keeping every other course in the schedule at its currently-assigned section.
 *
 * A candidate qualifies when it (a) passes the level/language/elective/prefix
 * filters, (b) is prerequisite-eligible given the completed courses, (c) isn't
 * already in the schedule or excluded, and (d) has at least one section combo —
 * under the supplied constraints — that doesn't overlap any of the other
 * enrollments. This is the pure core of the web store's basic-mode swap search,
 * lifted so the native app can reuse the identical logic.
 */
export function findSwapCandidates(input: FindSwapCandidatesInput): NormalizedCourseCode[] {
  const {
    cache,
    enrollments,
    enrollmentIndex,
    constraints,
    includeClosedComponents,
    virtualSectionsOnly,
    completedCourses = [],
    studentPrograms = [],
    filters,
    electiveLevelBuckets = [],
    excludedPrefixes = [],
  } = input;

  const enrollment = enrollments[enrollmentIndex];
  if (!enrollment) return [];

  const oldCode = enrollment.courseCode;
  const comboCache = input.comboCache ?? new Map<string, CourseEnrollment[]>();
  const prereqCtx = buildPrereqContext(completedCourses, cache, studentPrograms);
  const alreadyInSchedule = new Set(enrollments.map((e) => e.courseCode));
  const excluded = new Set<NormalizedCourseCode>();
  for (const code of input.excludeCodes ?? []) excluded.add(normalizeCourseCode(code));

  // The other courses keep their currently-assigned sections; a candidate is
  // feasible if it has at least one section combo that satisfies the time
  // constraints and doesn't overlap any of them.
  const others = enrollments.filter((_, i) => i !== enrollmentIndex);

  const candidates: NormalizedCourseCode[] = [];
  for (const course of cache.getAllCourses()) {
    const code = course.code;
    if (code === oldCode) continue;
    if (alreadyInSchedule.has(code)) continue;
    if (excluded.has(code)) continue;
    if (filters && !courseMatchesFilters(code, filters)) continue;
    if (!isWithinElectiveLevelBuckets(code, electiveLevelBuckets)) continue;
    if (isHonoursProject(code, cache)) continue;
    if (
      !isSwapCandidateEligible(
        course,
        cache,
        prereqCtx,
        completedCourses.length > 0,
        excludedPrefixes,
      )
    )
      continue;
    if (
      !courseFitsAroundOthers(
        cache,
        code,
        constraints,
        includeClosedComponents,
        virtualSectionsOnly,
        others,
        comboCache,
      )
    )
      continue;

    candidates.push(code);
  }

  return candidates;
}

/**
 * Shared eligibility gate for swap candidates: rejects courses whose prefix is
 * excluded, and applies the prerequisite rules (when the student has completed
 * courses, structured prerequisites are evaluated and free-text prereqs are
 * rejected; otherwise any course with prerequisites is rejected).
 */
export function isSwapCandidateEligible(
  course: Course,
  cache: DataCache,
  prereqCtx: PrereqContext,
  hasCompletedCourses: boolean,
  excludedPrefixes: readonly string[],
): boolean {
  const code = course.code;
  const prefixMatch = code.match(/^([A-Z]{3,4})/i);
  const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
  if (excludedPrefixes.includes(prefix)) return false;

  if (hasCompletedCourses) {
    if (course.prerequisites) {
      if (!canTakeCourse(code, cache, prereqCtx)) return false;
    } else if (course.prereqText) {
      return false;
    }
  } else if (course.prerequisites || course.prereqText) {
    return false;
  }

  return true;
}

/**
 * Returns true when `code` has at least one valid section combo (under the given
 * constraints) that doesn't overlap any of the `others` enrollments. Memoizes the
 * possible enrollments per course/component flags into `comboCache`.
 */
export function courseFitsAroundOthers(
  cache: DataCache,
  code: NormalizedCourseCode,
  constraints: GenerationConstraints,
  includeClosedComponents: boolean,
  virtualSectionsOnly: boolean,
  others: readonly CourseEnrollment[],
  comboCache: Map<string, CourseEnrollment[]>,
): boolean {
  const cacheKey = `${code}:${includeClosedComponents}:${virtualSectionsOnly}`;
  let possibleEnrollments = comboCache.get(cacheKey);
  if (!possibleEnrollments) {
    const sched = getEffectiveSchedule(cache, code, includeClosedComponents, virtualSectionsOnly);
    if (!sched) {
      possibleEnrollments = [];
    } else {
      const combos = getValidSectionCombos(sched, constraints);
      possibleEnrollments = combos.map((combo) => getEnrollmentsForCourse(sched, combo));
    }
    comboCache.set(cacheKey, possibleEnrollments);
  }
  if (possibleEnrollments.length === 0) return false;

  return possibleEnrollments.some(
    (candidate) => !others.some((e) => enrollmentsOverlap(e, candidate)),
  );
}

/** A swap candidate enriched with the display data the swap UI shows. */
export interface SwapOptionView {
  code: NormalizedCourseCode;
  title: string | null;
  /** `${code} — ${title}` (or just the code) for search / labelling. */
  label: string;
  /** Percentage of A+ grades across the course's offerings. */
  aPlusPercent: number | null;
  /** Mean RateMyProfessors rating across the course's instructors. */
  avgRating: number | null;
  /** Mean course GPA (0–10) from the aggregated grade distribution. */
  gpa: number | null;
  /** Difficulty bucket derived from {@link gpa}. */
  difficulty: SwapDifficulty | null;
  /** Normalized grade distribution for the histogram, or null when unknown. */
  gradeViz: GradeVizData | null;
}

/**
 * Build the display view-model for a single swap candidate — title, A+ %, mean
 * professor rating, GPA/difficulty, and grade distribution — from the data
 * cache and ratings map. Shared by the web swap list and the native swap section
 * so both surface identical candidate stats.
 */
export function buildSwapOptionView(
  code: string,
  cache: DataCache | null,
  professorRatings: ProfessorRatingsMap | null,
): SwapOptionView {
  const norm = normalizeCourseCode(code);
  const course = cache?.getCourse(norm);
  const title = (course?.title ?? "").trim() || null;
  const sched = cache?.getSchedule(norm);
  const aPlusPercent = sched ? courseAPlusPercent(sched) : null;
  const dist = sched ? aggregateCourseDistribution(sched) : null;
  const gpa = dist ? distributionGpa(dist) : null;
  const gradeViz = dist ? normalizeGradeVizDistribution(dist) : null;
  const difficulty = gpa != null ? difficultyBucket(gpa) : null;

  const instructors = sched
    ? [
        ...new Set(
          Object.values(sched.components ?? {})
            .flat()
            .flatMap((sec) => sec.times.map((t) => t.instructor))
            .filter((i): i is string => typeof i === "string"),
        ),
      ]
    : [];
  const ratings = getRatingsForInstructors(instructors, professorRatings);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const label = title ? `${norm} — ${title}` : norm;
  return { code: norm, title, label, aPlusPercent, avgRating, gpa, difficulty, gradeViz };
}
