import type { CourseSchedule } from "./dataTypes";
import type { DataCache } from "./dataCache";

/**
 * uOttawa official letter grades → 10-point numeric values for GPA-style summaries.
 * Scale per policy A-3.1 (https://www.uottawa.ca/.../a-3-grading-system). The scale
 * has no B-/C-/D- grades; ABS/EIN count as 0 but are handled via SKIP_GRADES below.
 */
export const GRADE_POINTS: Record<string, number> = {
  "A+": 10,
  A: 9,
  "A-": 8,
  "B+": 7,
  B: 6,
  "C+": 5,
  C: 4,
  "D+": 3,
  D: 2,
  E: 1,
  F: 0,
};

const SKIP_GRADES = new Set(["P", "S", "NS", "NC", "ABS", "EIN"]);

export const GRADE_VIZ_COLORS = {
  red: "#A32D2D",
  amber: "#BA7517",
  yellow: "#d4b800",
  blue: "#3266ad",
  teal: "#5a9e7a",
  green: "#1D9E75",
} as const;

export type GradeVizBucketId = keyof typeof GRADE_VIZ_COLORS;

export interface GradeVizBucket {
  id: GradeVizBucketId;
  label: string;
  color: string;
  count: number;
}

export interface GradeVizData {
  total: number;
  passingPercent: number;
  buckets: GradeVizBucket[];
  histogram: Array<{ grade: string; count: number; bucketId: GradeVizBucketId; color: string }>;
}

const GRADE_BUCKET_DEFS: Array<{ id: GradeVizBucketId; label: string; grades: string[] }> = [
  { id: "red", label: "Failing", grades: ["F", "E", "ABS", "EIN", "NS"] },
  { id: "amber", label: "Low pass", grades: ["D", "D+"] },
  { id: "yellow", label: "Mid pass", grades: ["C", "C+"] },
  { id: "blue", label: "Good", grades: ["B", "B+", "S"] },
  { id: "teal", label: "Near excellent", grades: ["A-"] },
  { id: "green", label: "Excellent", grades: ["A", "A+", "P"] },
];

const GRADE_TO_BUCKET = new Map<string, GradeVizBucketId>(
  GRADE_BUCKET_DEFS.flatMap((def) => def.grades.map((grade) => [grade, def.id] as const)),
);

const HISTOGRAM_GRADE_ORDER = [
  "NS",
  "EIN",
  "ABS",
  "F",
  "E",
  "D",
  "D+",
  "C",
  "C+",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
] as const;

/**
 * Weighted mean GPA over counted letter grades (excludes P/S/NS/NC/ABS/EIN).
 * Returns null if there is no countable mass.
 */
export function distributionGpa(dist: Record<string, number> | null | undefined): number | null {
  if (!dist || typeof dist !== "object") return null;
  let weighted = 0;
  let mass = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (SKIP_GRADES.has(letter)) continue;
    const pts = GRADE_POINTS[letter];
    if (pts === undefined) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    weighted += pts * n;
    mass += n;
  }
  if (mass <= 0) return null;
  return weighted / mass;
}

/** Sum every section's optional `distribution` across all components. */
export function aggregateCourseDistribution(schedule: CourseSchedule): Record<string, number> {
  const parts: Record<string, number>[] = [];
  for (const sections of Object.values(schedule.components ?? {})) {
    if (!Array.isArray(sections)) continue;
    for (const sec of sections) {
      const d = sec?.distribution;
      if (d && typeof d === "object") parts.push(d);
    }
  }
  const out: Record<string, number> = {};
  for (const d of parts) {
    for (const [k, v] of Object.entries(d)) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

/** Course-level GPA from aggregated section distributions. */
export function courseGpa(schedule: CourseSchedule): number | null {
  return distributionGpa(aggregateCourseDistribution(schedule));
}

/**
 * Fraction of graded students who received A+, as a percentage 0–100.
 * Returns null if there is no countable mass.
 */
export function aPlusPercent(dist: Record<string, number> | null | undefined): number | null {
  if (!dist || typeof dist !== "object") return null;
  const aPlus = Number(dist["A+"] ?? 0);
  let total = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (SKIP_GRADES.has(letter)) continue;
    const pts = GRADE_POINTS[letter];
    if (pts === undefined) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    total += n;
  }
  if (total <= 0) return null;
  return (aPlus / total) * 100;
}

/** Course-level A+ percentage from aggregated section distributions. */
export function courseAPlusPercent(schedule: CourseSchedule): number | null {
  return aPlusPercent(aggregateCourseDistribution(schedule));
}

/**
 * Maps a course code to its A+ percentage (0–100), or `null` when no grade data
 * is available. This is the explicit input the schedule generator uses for its
 * "prefer easier" heuristic, so the solver never reaches into where grade data
 * physically lives (today: embedded in the schedule cache; later: a lazily
 * loaded grades source).
 */
export type CourseDifficultyIndex = (courseCode: string) => number | null;

/**
 * Behavior-preserving difficulty index built from the grade distributions
 * currently embedded in the schedule cache. Phase 3 will introduce an
 * alternative builder backed by a separately loaded grades dataset; the
 * generator contract stays the same.
 */
export function buildCourseDifficultyIndexFromCache(cache: DataCache): CourseDifficultyIndex {
  const memo = new Map<string, number | null>();
  return (code: string): number | null => {
    const cached = memo.get(code);
    if (cached !== undefined) return cached;
    const sched = cache.getSchedule(code);
    const value = sched ? courseAPlusPercent(sched) : null;
    memo.set(code, value);
    return value;
  };
}

/**
 * Normalizes mixed letter/pass-fail distributions into ordered visualization buckets.
 */
export function normalizeGradeVizDistribution(
  distribution: Record<string, number> | null | undefined,
): GradeVizData | null {
  if (!distribution || typeof distribution !== "object") return null;

  const countsByGrade = new Map<string, number>();
  for (const [gradeRaw, valueRaw] of Object.entries(distribution)) {
    const grade = gradeRaw.trim().toUpperCase();
    const value = Number(valueRaw);
    if (!grade || !Number.isFinite(value) || value <= 0) continue;
    if (!GRADE_TO_BUCKET.has(grade)) continue;
    countsByGrade.set(grade, (countsByGrade.get(grade) ?? 0) + value);
  }

  const total = [...countsByGrade.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const buckets: GradeVizBucket[] = GRADE_BUCKET_DEFS.map((def) => {
    const count = def.grades.reduce((sum, grade) => sum + (countsByGrade.get(grade) ?? 0), 0);
    return {
      id: def.id,
      label: def.label,
      color: GRADE_VIZ_COLORS[def.id],
      count,
    };
  });

  const failingCount = buckets.find((bucket) => bucket.id === "red")?.count ?? 0;
  const passingPercent = ((total - failingCount) / total) * 100;

  const histogram: GradeVizData["histogram"] = HISTOGRAM_GRADE_ORDER.map((grade) => {
    const bucketId = GRADE_TO_BUCKET.get(grade) ?? "red";
    return {
      grade,
      count: countsByGrade.get(grade) ?? 0,
      bucketId,
      color: GRADE_VIZ_COLORS[bucketId],
    };
  });

  return {
    total,
    passingPercent,
    buckets,
    histogram,
  };
}
