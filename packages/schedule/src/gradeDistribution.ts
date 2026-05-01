import type { CourseSchedule } from './dataTypes';

/** Ottawa-style letter grades → 4.3-scale points for GPA-style summaries. */
export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.3,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'D+': 1.3,
  D: 1.0,
  E: 0.5,
  F: 0,
};

const SKIP_GRADES = new Set(['P', 'S', 'NS', 'NC', 'ABS', 'EIN']);

export const GRADE_VIZ_COLORS = {
  red: '#A32D2D',
  amber: '#BA7517',
  yellow: '#d4b800',
  blue: '#3266ad',
  teal: '#5a9e7a',
  green: '#1D9E75',
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
  { id: 'red', label: 'Failing', grades: ['F', 'E', 'ABS', 'EIN', 'NS'] },
  { id: 'amber', label: 'Low pass', grades: ['D', 'D+'] },
  { id: 'yellow', label: 'Mid pass', grades: ['C', 'C+'] },
  { id: 'blue', label: 'Good', grades: ['B', 'B+', 'S'] },
  { id: 'teal', label: 'Near excellent', grades: ['A-'] },
  { id: 'green', label: 'Excellent', grades: ['A', 'A+', 'P'] },
];

const GRADE_TO_BUCKET = new Map<string, GradeVizBucketId>(
  GRADE_BUCKET_DEFS.flatMap((def) => def.grades.map((grade) => [grade, def.id] as const)),
);

const HISTOGRAM_GRADE_ORDER = [
  'NS',
  'EIN',
  'ABS',
  'F',
  'E',
  'D',
  'D+',
  'C',
  'C+',
  'B',
  'B+',
  'A-',
  'A',
  'A+',
] as const;

/**
 * Weighted mean GPA over counted letter grades (excludes P/S/NS/NC/ABS/EIN).
 * Returns null if there is no countable mass.
 */
export function distributionGpa(dist: Record<string, number> | null | undefined): number | null {
  if (!dist || typeof dist !== 'object') return null;
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
      if (d && typeof d === 'object') parts.push(d);
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
 * Normalizes mixed letter/pass-fail distributions into ordered visualization buckets.
 */
export function normalizeGradeVizDistribution(
  distribution: Record<string, number> | null | undefined,
): GradeVizData | null {
  if (!distribution || typeof distribution !== 'object') return null;

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

  const failingCount = buckets.find((bucket) => bucket.id === 'red')?.count ?? 0;
  const passingPercent = ((total - failingCount) / total) * 100;

  const histogram: GradeVizData['histogram'] = HISTOGRAM_GRADE_ORDER.map((grade) => {
    const bucketId = GRADE_TO_BUCKET.get(grade) ?? 'red';
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
