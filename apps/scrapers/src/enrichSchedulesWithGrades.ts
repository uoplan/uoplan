/**
 * Enrich schedule JSON with per-section grade `distribution` from grades data
 * (instructor match → course aggregate fallback).
 */

export type GradeDistribution = Record<string, number>;

export interface GradeEnrichmentStats {
  sectionsTotal: number;
  matched: number;
  fallback: number;
  none: number;
}

export interface GradeLookups {
  byCourse: Map<string, Map<string, GradeDistribution>>;
  aggregateByCourse: Map<string, GradeDistribution>;
}

/** Top-level JSON written by schedule scraper / consumed by enrich CLI. */
export interface SchedulesFilePayload {
  termId?: string;
  totalCourses?: number;
  totalWithSchedules?: number;
  schedules: ScheduleCourseRow[];
}

/**
 * Minimal row shape the enricher walks. Uses a structural section type so scraper
 * `ComponentSection` (extra fields) assigns without `Record` index-signature issues.
 */
export type ScheduleCourseRow = {
  courseCode?: string;
  components?: Record<string, SectionGradeFields[]>;
};

/** Section fields read/written by enrichment (matches protobuf map keys in build_proto). */
export interface SectionGradeFields {
  instructors?: string[];
  distribution?: GradeDistribution;
}

function normalizeNameForMatch(value: string): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sumDistributions(dists: Array<GradeDistribution | null | undefined>): GradeDistribution {
  const out: GradeDistribution = {};
  for (const d of dists) {
    if (!d || typeof d !== 'object') continue;
    for (const [k, v] of Object.entries(d)) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

function hasGradeData(dist: GradeDistribution | null | undefined): boolean {
  if (!dist || typeof dist !== 'object') return false;
  for (const v of Object.values(dist)) {
    if (Number(v) > 0) return true;
  }
  return false;
}

function distributionForSection(
  instructors: string[] | undefined,
  profMap: Map<string, GradeDistribution> | undefined,
  courseAggregate: GradeDistribution | undefined,
): { distribution?: GradeDistribution; kind: 'matched' | 'fallback' | 'none' } {
  const matchedParts: GradeDistribution[] = [];
  const seen = new Set<string>();

  if (Array.isArray(instructors)) {
    for (const raw of instructors) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const norm = normalizeNameForMatch(trimmed);
      if (!norm || norm === 'staff') continue;
      if (seen.has(norm)) continue;
      seen.add(norm);

      const entry = profMap?.get(norm);
      if (entry && hasGradeData(entry)) {
        matchedParts.push(entry);
      }
    }
  }

  if (matchedParts.length > 0) {
    const merged = sumDistributions(matchedParts);
    if (hasGradeData(merged)) {
      return { distribution: merged, kind: 'matched' };
    }
  }

  if (courseAggregate && hasGradeData(courseAggregate)) {
    return { distribution: courseAggregate, kind: 'fallback' };
  }

  return { kind: 'none' };
}

export function buildGradeLookups(gradesRaw: unknown): GradeLookups {
  const byCourse = new Map<string, Map<string, GradeDistribution>>();
  const aggregateByCourse = new Map<string, GradeDistribution>();

  if (!Array.isArray(gradesRaw)) {
    throw new Error('grades.json: expected top-level array');
  }

  for (const row of gradesRaw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { code?: unknown; professors?: unknown };
    const code = r.code;
    if (typeof code !== 'string' || !code.trim()) continue;
    const professors = Array.isArray(r.professors) ? r.professors : [];

    let profMap = byCourse.get(code);
    if (!profMap) {
      profMap = new Map();
      byCourse.set(code, profMap);
    }

    const allDists: GradeDistribution[] = [];
    for (const p of professors) {
      if (!p || typeof p !== 'object') continue;
      const prof = p as { name?: unknown; distribution?: unknown };
      const name = prof.name;
      if (typeof name !== 'string' || !name.trim()) continue;
      const dist = prof.distribution;
      if (!dist || typeof dist !== 'object') continue;

      const key = normalizeNameForMatch(name);
      if (!key) continue;

      const existing = profMap.get(key);
      if (existing) {
        profMap.set(key, sumDistributions([existing, dist as GradeDistribution]));
      } else {
        profMap.set(key, { ...(dist as GradeDistribution) });
      }
      allDists.push(dist as GradeDistribution);
    }

    aggregateByCourse.set(code, sumDistributions(allDists));
  }

  return { byCourse, aggregateByCourse };
}

export function enrichSchedulesPayload(
  data: { schedules?: ScheduleCourseRow[] },
  lookups: GradeLookups,
  stats: GradeEnrichmentStats,
): { schedules?: ScheduleCourseRow[] } {
  const schedules = data.schedules;
  if (!Array.isArray(schedules)) return data;

  for (const course of schedules) {
    if (!course || typeof course !== 'object') continue;
    const courseCode = course.courseCode;
    if (typeof courseCode !== 'string') continue;

    const profMap = lookups.byCourse.get(courseCode);
    const aggregate = lookups.aggregateByCourse.get(courseCode);

    const components = course.components;
    if (!components || typeof components !== 'object') continue;

    for (const sections of Object.values(components)) {
      if (!Array.isArray(sections)) continue;
      for (const section of sections) {
        if (!section || typeof section !== 'object') continue;
        stats.sectionsTotal += 1;

        const prev = section.distribution;
        delete section.distribution;

        const { distribution, kind } = distributionForSection(
          section.instructors,
          profMap,
          aggregate,
        );

        if (distribution && kind !== 'none') {
          section.distribution = distribution;
          if (kind === 'matched') stats.matched += 1;
          else stats.fallback += 1;
        } else {
          stats.none += 1;
          if (prev !== undefined) {
            /* omit — remove stale data */
          }
        }
      }
    }
  }

  return data;
}

export function pct(n: number, d: number): string {
  return d === 0 ? '0.0' : ((100 * n) / d).toFixed(1);
}

export function formatGradeEnrichmentLine(
  label: string,
  stats: Pick<GradeEnrichmentStats, 'sectionsTotal' | 'matched' | 'fallback' | 'none'>,
): string {
  const { sectionsTotal: s, matched, fallback, none } = stats;
  return (
    `${label}: sections=${s} matched=${matched} (${pct(matched, s)}%) ` +
    `fallback=${fallback} (${pct(fallback, s)}%) ` +
    `noData=${none} (${pct(none, s)}%)`
  );
}
