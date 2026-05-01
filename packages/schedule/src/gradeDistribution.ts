import type { CourseSchedule } from 'schemas';

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
