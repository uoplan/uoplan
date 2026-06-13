import type { CourseSchedule, GradeDistribution } from "./dataTypes";
import type { DataCache } from "./dataCache";
import { sumGradeDistributions } from "./gradeLookup";

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

const SKIP_GRADES = new Set(["P", "S", "NS", "NC", "ABS", "EIN", "DR"]);

/** Letter grades that count toward GPA / graded totals (the 10-point scale). */
const COUNTED_GRADES = Object.keys(GRADE_POINTS);

/** Summed count of grades that contribute to GPA/averages (excludes P/S/NS/NC/ABS/EIN). */
export function countedMass(dist: GradeDistribution): number {
  let total = 0;
  for (const letter of COUNTED_GRADES) {
    const n = Number(dist[letter] ?? 0);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

export const GRADE_VIZ_COLORS = {
  red: "#A32D2D",
  amber: "#BA7517",
  yellow: "#d4b800",
  blue: "#3266ad",
  teal: "#5a9e7a",
  green: "#1D9E75",
  grey: "#7A7A7A",
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
  /** Graded students only (excludes withdrawals); denominator for passing% / A+%. */
  gradedTotal: number;
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
  { id: "grey", label: "Withdrew", grades: ["DR"] },
];

const GRADE_TO_BUCKET = new Map<string, GradeVizBucketId>(
  GRADE_BUCKET_DEFS.flatMap((def) => def.grades.map((grade) => [grade, def.id] as const)),
);

const HISTOGRAM_GRADE_ORDER = [
  "DR",
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

function gradePointEntriesExcludingSkipped(
  dist: Record<string, number>,
): Array<{ points: number; count: number }> {
  const entries: Array<{ points: number; count: number }> = [];
  for (const [letter, count] of Object.entries(dist)) {
    if (SKIP_GRADES.has(letter)) continue;
    const pts = GRADE_POINTS[letter];
    if (pts === undefined) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) continue;
    entries.push({ points: pts, count: n });
  }
  return entries;
}

function massExcludingSkippedGrades(dist: Record<string, number>): number {
  let mass = 0;
  for (const { count } of gradePointEntriesExcludingSkipped(dist)) mass += count;
  return mass;
}

/**
 * Weighted mean GPA over counted letter grades (excludes P/S/NS/NC/ABS/EIN).
 * Returns null if there is no countable mass.
 */
export function distributionGpa(dist: Record<string, number> | null | undefined): number | null {
  if (!dist || typeof dist !== "object") return null;
  let weighted = 0;
  let mass = 0;
  for (const { points, count } of gradePointEntriesExcludingSkipped(dist)) {
    weighted += points * count;
    mass += count;
  }
  if (mass <= 0) return null;
  return weighted / mass;
}

/** Sum every section's optional `distribution` across all components. */
export function aggregateCourseDistribution(schedule: CourseSchedule): Record<string, number> {
  const parts: GradeDistribution[] = [];
  for (const sections of Object.values(schedule.components ?? {})) {
    if (!Array.isArray(sections)) continue;
    for (const sec of sections) {
      const d = sec?.distribution;
      if (d && typeof d === "object") parts.push(d);
    }
  }
  return sumGradeDistributions(parts);
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
  const total = massExcludingSkippedGrades(dist);
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
  const withdrewCount = buckets.find((bucket) => bucket.id === "grey")?.count ?? 0;
  const gradedTotal = total - withdrewCount;
  const passingPercent = gradedTotal > 0 ? ((gradedTotal - failingCount) / gradedTotal) * 100 : 0;

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
    gradedTotal,
    passingPercent,
    buckets,
    histogram,
  };
}

// ---------------------------------------------------------------------------
// Histogram display model (shared by the web + native grade charts)
// ---------------------------------------------------------------------------

/** Letter-grade failures merged into the single "Fail" bar (NS is shown via the S/NS bar). */
const HISTOGRAM_FAIL_GRADES = ["F", "E", "ABS", "EIN"] as const;
/** Individual letter bars shown after the combined "Fail" bar (low → high). */
const HISTOGRAM_LETTER_BAR_ORDER = ["D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"] as const;

/** One bar in the rendered grade histogram (before platform-specific labels). */
export interface GradeHistogramDisplayBar {
  /** Stable key: "DR" (withdrew), "FAIL" (merged failures) or a letter grade. */
  key: string;
  /** The underlying grade letter for letter bars; "DR"/"F" for the special bars. */
  grade: string;
  count: number;
  bucketId: GradeVizBucketId;
}

/** Presentation model for the vertical grade histogram, derived purely from a
 * {@link GradeVizData}. Platform leaves (web Mantine, native RN) render this the
 * same way; only the localized labels are supplied per platform. */
export interface GradeHistogramModel {
  /** Withdrew (DR) + merged Fail + 9 letter bars, low → high. */
  displayBars: GradeHistogramDisplayBar[];
  /** Satisfactory (S) count for the trailing S/NS stacked bar. */
  sCount: number;
  /** Not-satisfactory (NS) count for the trailing S/NS stacked bar. */
  nsCount: number;
  /** S + NS total (denominator for the stacked S/NS bar). */
  snsTotal: number;
  /** Largest bar count (≥ 1), used to scale bar heights. */
  maxHistogramCount: number;
}

/**
 * Build the ordered display model for the grade histogram from a
 * {@link GradeVizData}: a withdrew (DR) bar, a single merged "Fail" bar, the nine
 * passing letter bars (D → A+), plus the S/NS aggregate. Pure + platform-neutral
 * so the web and native charts stay pixel-equivalent.
 */
export function buildGradeHistogramModel(gradeViz: GradeVizData): GradeHistogramModel {
  const byGrade = new Map(gradeViz.histogram.map((entry) => [entry.grade, entry]));
  const countOf = (grade: string) => byGrade.get(grade)?.count ?? 0;

  const sCount = countOf("S");
  const nsCount = countOf("NS");
  const snsTotal = sCount + nsCount;

  const failCount = HISTOGRAM_FAIL_GRADES.reduce((sum, grade) => sum + countOf(grade), 0);

  const displayBars: GradeHistogramDisplayBar[] = [
    { key: "DR", grade: "DR", count: countOf("DR"), bucketId: "grey" },
    { key: "FAIL", grade: "F", count: failCount, bucketId: "red" },
    ...HISTOGRAM_LETTER_BAR_ORDER.map(
      (grade): GradeHistogramDisplayBar => ({
        key: grade,
        grade,
        count: countOf(grade),
        bucketId: byGrade.get(grade)?.bucketId ?? "red",
      }),
    ),
  ];

  const maxHistogramCount = Math.max(...displayBars.map((bar) => bar.count), 1);
  return { sCount, nsCount, snsTotal, displayBars, maxHistogramCount };
}
