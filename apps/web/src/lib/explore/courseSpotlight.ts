import { distributionGpa, GRADE_POINTS, normalizeCourseCode } from "@uoplan/schedule";
import {
  buildCourseSearchEntries,
  groupOfferingsByProfessor,
  mergeGradeDistributionCounts,
  type ExploreCourseSearchEntry,
  type ExploreOfferingFlat,
} from "./gradesSearch";

const SKIP_GRADES = new Set(["P", "S", "NS", "NC", "ABS", "EIN"]);
const FAIL_GRADES = new Set(["F", "E", "ABS"]);

/** Minimum countable graded students before a course can appear in spotlight lists. */
export const SPOTLIGHT_MIN_GRADED_COUNT = 40;

/** Max courses returned per spotlight variant. */
const SPOTLIGHT_TOP_N = 16;

/** Hide the gallery when fewer than this many courses qualify. */
export const SPOTLIGHT_MIN_GALLERY_ITEMS = 6;

export const SPOTLIGHT_VARIANTS = [
  "hardest",
  "easiest",
  "mostGraded",
  "highestFailRate",
  "mostProfessors",
] as const;

export type CourseSpotlightVariant = (typeof SPOTLIGHT_VARIANTS)[number];

type CourseSpotlightRecord = {
  entry: ExploreCourseSearchEntry;
  gpa: number;
  gradedCount: number;
  failRate: number;
  professorCount: number;
};

export type CourseSpotlightStat =
  | { kind: "gpa"; value: number }
  | { kind: "gradeCount"; value: number }
  | { kind: "failRate"; value: number }
  | { kind: "professorCount"; value: number };

export type RankedSpotlightCourse = {
  entry: ExploreCourseSearchEntry;
  stat: CourseSpotlightStat;
};

export function pickSpotlightVariant(rng: () => number = Math.random): CourseSpotlightVariant {
  const i = Math.floor(rng() * SPOTLIGHT_VARIANTS.length);
  return SPOTLIGHT_VARIANTS[Math.min(i, SPOTLIGHT_VARIANTS.length - 1)];
}

/** Pick distinct spotlight variants (e.g. three marquee rows). */
export function pickSpotlightVariants(
  count: number,
  rng: () => number = Math.random,
): CourseSpotlightVariant[] {
  const pool = [...SPOTLIGHT_VARIANTS];
  const n = Math.min(Math.max(0, count), pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}

/** Per-row marquee timing (seconds) for multi-row galleries. */
export const SPOTLIGHT_ROW_DURATIONS_SEC = [150, 115, 90] as const;

/** Count grades that contribute to GPA (same rules as distributionGpa). */
export function gradedHeadcount(dist: Record<string, number>): number {
  let mass = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (SKIP_GRADES.has(letter)) continue;
    if (GRADE_POINTS[letter] === undefined) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    mass += n;
  }
  return mass;
}

/** F + E + ABS counts for fail-rate spotlight. */
function failHeadcount(dist: Record<string, number>): number {
  let fail = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (!FAIL_GRADES.has(letter)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    fail += n;
  }
  return fail;
}

export function buildCourseSpotlightIndex(
  offerings: ExploreOfferingFlat[],
  titleByCode: Map<string, string>,
): Map<string, CourseSpotlightRecord> {
  const byNorm = new Map<string, ExploreOfferingFlat[]>();
  for (const o of offerings) {
    const norm = normalizeCourseCode(o.courseCode);
    let list = byNorm.get(norm);
    if (!list) {
      list = [];
      byNorm.set(norm, list);
    }
    list.push(o);
  }

  const entries = buildCourseSearchEntries(offerings, titleByCode);
  const entryByNorm = new Map(entries.map((e) => [e.normCode, e]));

  const index = new Map<string, CourseSpotlightRecord>();
  for (const [norm, courseOfferings] of byNorm) {
    const mergedDist = mergeGradeDistributionCounts(courseOfferings.map((o) => o.distribution));
    const gpa = distributionGpa(mergedDist);
    const gradedCount = gradedHeadcount(mergedDist);
    if (gpa == null || gradedCount < SPOTLIGHT_MIN_GRADED_COUNT) continue;

    const failRate = failHeadcount(mergedDist) / gradedCount;
    const professorCount = groupOfferingsByProfessor(courseOfferings).length;
    const entry = entryByNorm.get(norm);
    if (!entry) continue;

    index.set(norm, {
      entry,
      gpa,
      gradedCount,
      failRate,
      professorCount,
    });
  }
  return index;
}

function statForVariant(
  variant: CourseSpotlightVariant,
  record: CourseSpotlightRecord,
): CourseSpotlightStat {
  switch (variant) {
    case "hardest":
    case "easiest":
      return { kind: "gpa", value: record.gpa };
    case "mostGraded":
      return { kind: "gradeCount", value: record.gradedCount };
    case "highestFailRate":
      return { kind: "failRate", value: record.failRate };
    case "mostProfessors":
      return { kind: "professorCount", value: record.professorCount };
  }
}

export function rankCoursesForSpotlight(
  index: Map<string, CourseSpotlightRecord>,
  variant: CourseSpotlightVariant,
  limit = SPOTLIGHT_TOP_N,
): RankedSpotlightCourse[] {
  const records = [...index.values()];
  records.sort((a, b) => {
    switch (variant) {
      case "hardest":
        return a.gpa - b.gpa;
      case "easiest":
        return b.gpa - a.gpa;
      case "mostGraded":
        return b.gradedCount - a.gradedCount;
      case "highestFailRate":
        return b.failRate - a.failRate;
      case "mostProfessors":
        return b.professorCount - a.professorCount;
    }
  });

  return records.slice(0, limit).map((record) => ({
    entry: record.entry,
    stat: statForVariant(variant, record),
  }));
}
