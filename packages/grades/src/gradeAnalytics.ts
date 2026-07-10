import type { CourseGradesData, GradeDistribution } from "@uoplan/domain/dataTypes";
import {
  distributionGpa,
  GRADE_VIZ_COLORS,
  normalizeGradeVizDistribution,
} from "./gradeDistribution";
import type { GradeVizBucketId } from "./gradeDistribution";
import {
  addInto,
  aggregateByKey,
  countedMass,
  courseMatchesTrendFilters,
  decodeTermMeta,
  disciplineKeyFor,
  mergeDistributionByTerm,
  metricsForDistribution,
  usableOffering,
} from "./gradeTrends";
import type { TermSeason, TrendFilters, TrendPoint } from "./gradeTrends";
import { disciplineOf, levelOf, normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

/**
 * Higher-level grade analytics derived from the runtime grades dataset
 * ({@link CourseGradesData}), powering the richer charts on the trends page
 * (discipline comparison, grade histogram, popularity↔GPA scatter, season /
 * level effects, discipline×year heatmap, grade-band composition, professor
 * spread). Everything here is pure and unit-tested; the web layer handles
 * loading, memoisation, localisation, and rendering.
 *
 * GPA is on the shared 0–10 scale (policy A-3.1), matching {@link gradeTrends}.
 */

/** Metrics shared by the comparison/heatmap charts (volume handled separately). */
export type AnalyticsMetric = "gpa" | "aPlus" | "aRange" | "pass";

type DistributionMetrics = Omit<TrendPoint, "termId" | "year" | "season" | "sortKey">;

/** Pick a single 0–100 (or 0–10 for GPA) metric value from a metrics bundle. */
export function metricValue(metrics: DistributionMetrics, metric: AnalyticsMetric): number | null {
  switch (metric) {
    case "gpa":
      return metrics.gpa;
    case "aPlus":
      return metrics.aPlusPct;
    case "aRange":
      return metrics.aRangePct;
    case "pass":
      return metrics.passPct;
  }
}

// ---------------------------------------------------------------------------
// Discipline comparison (ranked bar chart)
// ---------------------------------------------------------------------------

export interface DisciplineComparisonRow {
  discipline: string;
  gpa: number | null;
  aPlusPct: number | null;
  aRangePct: number | null;
  passPct: number | null;
  volume: number;
}

export interface DisciplineComparisonOptions {
  /** Course level bucket filter (1000, 2000, …). */
  level?: number | null;
  /** Academic season filter. */
  season?: TermSeason | null;
  /** Drop disciplines below this counted graded mass (default 200). */
  minVolume?: number;
}

const DEFAULT_DISCIPLINE_MIN_VOLUME = 200;

/**
 * Aggregate every offering into one distribution per discipline (over all terms
 * matching `level`/`season`) and return its metrics. Always cross-discipline —
 * the discipline filter is intentionally ignored. Disciplines below `minVolume`
 * are dropped. Sorted by discipline code; callers re-sort by the active metric.
 */
export function computeDisciplineComparison(
  grades: CourseGradesData,
  options: DisciplineComparisonOptions = {},
): DisciplineComparisonRow[] {
  const level = options.level ?? null;
  const season = options.season ?? null;
  const minVolume = options.minVolume ?? DEFAULT_DISCIPLINE_MIN_VOLUME;

  const byDiscipline = aggregateByKey(grades, season, disciplineKeyFor(level));

  const out: DisciplineComparisonRow[] = [];
  for (const [discipline, dist] of byDiscipline) {
    const metrics = metricsForDistribution(dist);
    if (metrics.volume < minVolume) continue;
    out.push({
      discipline,
      gpa: metrics.gpa,
      aPlusPct: metrics.aPlusPct,
      aRangePct: metrics.aRangePct,
      passPct: metrics.passPct,
      volume: metrics.volume,
    });
  }
  out.sort((a, b) => a.discipline.localeCompare(b.discipline));
  return out;
}

// ---------------------------------------------------------------------------
// Grade histogram (distribution bar chart for the current scope)
// ---------------------------------------------------------------------------

export interface GradeHistogramBar {
  grade: string;
  count: number;
  bucketId: GradeVizBucketId;
  color: string;
}

export interface GradeHistogram {
  total: number;
  passingPercent: number;
  bars: GradeHistogramBar[];
}

/**
 * Aggregate every matched offering into one distribution and normalise it into
 * an ordered letter-grade histogram (failing → A+). Honors the full filter set
 * (discipline / level / season / program). Returns null when no graded mass.
 */
export function computeGradeHistogram(
  grades: CourseGradesData,
  filters: TrendFilters = {},
): GradeHistogram | null {
  const season = filters.season ?? null;
  const byScope = aggregateByKey(grades, season, (course) =>
    courseMatchesTrendFilters(course.code, filters) ? 0 : null,
  );
  const total = byScope.get(0) ?? {};
  const viz = normalizeGradeVizDistribution(total);
  if (!viz) return null;
  return {
    total: viz.total,
    passingPercent: viz.passingPercent,
    bars: viz.histogram.map((h) => ({
      grade: h.grade,
      count: h.count,
      bucketId: h.bucketId,
      color: h.color,
    })),
  };
}

// ---------------------------------------------------------------------------
// Course scatter (popularity ↔ GPA, for choosing electives)
// ---------------------------------------------------------------------------

export interface CourseScatterPoint {
  code: string;
  /** Total counted graded mass across matched terms (popularity proxy). */
  volume: number;
  gpa: number | null;
  aPlusPct: number | null;
}

export interface CourseScatterOptions {
  /** Drop courses below this total counted graded mass (default 30). */
  minVolume?: number;
}

const DEFAULT_SCATTER_MIN_VOLUME = 30;

/**
 * One point per matched course: aggregate counted mass (x, popularity) vs mean
 * GPA (y). Honors the full filter set. Courses below `minVolume` are dropped.
 */
export function computeCourseScatter(
  grades: CourseGradesData,
  filters: TrendFilters = {},
  options: CourseScatterOptions = {},
): CourseScatterPoint[] {
  const minVolume = options.minVolume ?? DEFAULT_SCATTER_MIN_VOLUME;
  const season = filters.season ?? null;

  const byCourse = aggregateByKey(grades, season, (course) =>
    courseMatchesTrendFilters(course.code, filters) ? normalizeCourseCode(course.code) : null,
  );

  const out: CourseScatterPoint[] = [];
  for (const [code, dist] of byCourse) {
    const metrics = metricsForDistribution(dist);
    if (metrics.volume < minVolume) continue;
    out.push({ code, volume: metrics.volume, gpa: metrics.gpa, aPlusPct: metrics.aPlusPct });
  }
  out.sort((a, b) => b.volume - a.volume || a.code.localeCompare(b.code));
  return out;
}

// ---------------------------------------------------------------------------
// Season comparison (when is a course easiest?)
// ---------------------------------------------------------------------------

export interface SeasonComparisonRow {
  season: TermSeason;
  gpa: number | null;
  aPlusPct: number | null;
  aRangePct: number | null;
  passPct: number | null;
  volume: number;
}

const SEASON_ORDER: TermSeason[] = ["fall", "winter", "springSummer"];

/**
 * Aggregate matched offerings by academic season (Fall / Winter / Spring-Summer)
 * regardless of the `season` filter (we are comparing across seasons), honoring
 * the discipline / level / program filters. Returns rows only for seasons that
 * have graded data, in calendar order.
 */
export function computeSeasonComparison(
  grades: CourseGradesData,
  filters: TrendFilters = {},
): SeasonComparisonRow[] {
  const bySeason = aggregateByKey(grades, null, (course, termId) => {
    if (!courseMatchesTrendFilters(course.code, { ...filters, season: null })) return null;
    return decodeTermMeta(termId).season;
  });

  const out: SeasonComparisonRow[] = [];
  for (const season of SEASON_ORDER) {
    const dist = bySeason.get(season);
    if (!dist) continue;
    const metrics = metricsForDistribution(dist);
    if (metrics.volume <= 0) continue;
    out.push({
      season,
      gpa: metrics.gpa,
      aPlusPct: metrics.aPlusPct,
      aRangePct: metrics.aRangePct,
      passPct: metrics.passPct,
      volume: metrics.volume,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Level comparison (difficulty by course level)
// ---------------------------------------------------------------------------

export interface LevelComparisonRow {
  level: number;
  gpa: number | null;
  aPlusPct: number | null;
  aRangePct: number | null;
  passPct: number | null;
  volume: number;
}

export interface LevelComparisonOptions {
  discipline?: string | null;
  season?: TermSeason | null;
  /** Drop level buckets below this counted graded mass (default 50). */
  minVolume?: number;
}

const DEFAULT_LEVEL_MIN_VOLUME = 50;

/** Highest discrete level bucket; everything at or above collapses into `5000+`. */
export const MAX_LEVEL_BUCKET = 5000;

/**
 * Aggregate matched offerings by course-level bucket (1000, 2000, 3000, 4000,
 * 5000+) regardless of the `level` filter, honoring discipline / season. Levels
 * at or above {@link MAX_LEVEL_BUCKET} collapse into a single `5000+` bucket.
 * Ascending by level.
 */
export function computeLevelComparison(
  grades: CourseGradesData,
  options: LevelComparisonOptions = {},
): LevelComparisonRow[] {
  const discipline = options.discipline ? options.discipline.toUpperCase() : null;
  const season = options.season ?? null;
  const minVolume = options.minVolume ?? DEFAULT_LEVEL_MIN_VOLUME;

  const byLevel = aggregateByKey(grades, season, (course) => {
    if (discipline && disciplineOf(course.code) !== discipline) return null;
    const rawLevel = levelOf(course.code);
    if (rawLevel == null) return null;
    return Math.min(rawLevel, MAX_LEVEL_BUCKET);
  });

  const out: LevelComparisonRow[] = [];
  for (const [level, dist] of byLevel) {
    const metrics = metricsForDistribution(dist);
    if (metrics.volume < minVolume) continue;
    out.push({
      level,
      gpa: metrics.gpa,
      aPlusPct: metrics.aPlusPct,
      aRangePct: metrics.aRangePct,
      passPct: metrics.passPct,
      volume: metrics.volume,
    });
  }
  out.sort((a, b) => a.level - b.level);
  return out;
}

// ---------------------------------------------------------------------------
// Discipline × year heatmap (cross-discipline trends over time)
// ---------------------------------------------------------------------------

export interface DisciplineHeatmapCell {
  year: number;
  value: number | null;
  volume: number;
}

export interface DisciplineHeatmapRow {
  discipline: string;
  /** Total counted mass across all years (used for ranking/limiting). */
  totalVolume: number;
  cells: DisciplineHeatmapCell[];
}

export interface DisciplineHeatmap {
  years: number[];
  metric: AnalyticsMetric;
  rows: DisciplineHeatmapRow[];
}

export interface DisciplineHeatmapOptions {
  level?: number | null;
  season?: TermSeason | null;
  metric?: AnalyticsMetric;
  /** Drop a discipline-year cell below this counted mass (default 30). */
  minCellVolume?: number;
  /** Keep only the N highest-volume disciplines (default 16). */
  topDisciplines?: number;
}

const DEFAULT_HEATMAP_MIN_CELL_VOLUME = 30;
const DEFAULT_HEATMAP_TOP_DISCIPLINES = 16;

/**
 * Build a discipline × year matrix of the chosen metric. Always cross-discipline
 * (discipline filter ignored), honoring level / season. Cells below
 * `minCellVolume` are null; disciplines are limited to the highest-volume
 * `topDisciplines`. Years span the full observed range so the grid is dense.
 */
export function computeDisciplineYearHeatmap(
  grades: CourseGradesData,
  options: DisciplineHeatmapOptions = {},
): DisciplineHeatmap {
  const level = options.level ?? null;
  const season = options.season ?? null;
  const metric = options.metric ?? "gpa";
  const minCellVolume = options.minCellVolume ?? DEFAULT_HEATMAP_MIN_CELL_VOLUME;
  const topDisciplines = options.topDisciplines ?? DEFAULT_HEATMAP_TOP_DISCIPLINES;

  // discipline → year → distribution
  const byDiscipline = new Map<string, Map<number, GradeDistribution>>();
  const yearSet = new Set<number>();
  for (const course of grades.courses) {
    const discipline = disciplineOf(course.code);
    if (!discipline) continue;
    if (level != null && levelOf(course.code) !== level) continue;
    for (const prof of course.sections) {
      const off = usableOffering(prof, season);
      if (!off) continue;
      const meta = decodeTermMeta(off.termId);
      if (!meta.year) continue;
      yearSet.add(meta.year);
      mergeDistributionByTerm(byDiscipline, discipline, meta.year, off.distribution);
    }
  }

  const years = [...yearSet].sort((a, b) => a - b);

  const rows: DisciplineHeatmapRow[] = [];
  for (const [discipline, byYear] of byDiscipline) {
    let totalVolume = 0;
    const cells: DisciplineHeatmapCell[] = years.map((year) => {
      const dist = byYear.get(year);
      if (!dist) return { year, value: null, volume: 0 };
      const metrics = metricsForDistribution(dist);
      totalVolume += metrics.volume;
      const value = metrics.volume >= minCellVolume ? metricValue(metrics, metric) : null;
      return { year, value, volume: metrics.volume };
    });
    if (totalVolume <= 0) continue;
    rows.push({ discipline, totalVolume, cells });
  }

  rows.sort((a, b) => b.totalVolume - a.totalVolume || a.discipline.localeCompare(b.discipline));
  const limited = rows.slice(0, topDisciplines);
  limited.sort((a, b) => a.discipline.localeCompare(b.discipline));

  return { years, metric, rows: limited };
}

// ---------------------------------------------------------------------------
// Grade-band composition over time (stacked area)
// ---------------------------------------------------------------------------

export interface GradeBandTerm {
  termId: number;
  year: number;
  season: TermSeason | null;
  total: number;
  /** Per-bucket share as a percentage 0–100 (failing → excellent). */
  bands: Record<GradeVizBucketId, number>;
}

const BAND_IDS: GradeVizBucketId[] = ["red", "amber", "yellow", "blue", "teal", "green", "grey"];

function emptyBands(): Record<GradeVizBucketId, number> {
  return { red: 0, amber: 0, yellow: 0, blue: 0, teal: 0, green: 0, grey: 0 };
}

/** Ordered grade-band metadata (id → colour), for legends/series wiring. */
export const GRADE_BAND_META: ReadonlyArray<{ id: GradeVizBucketId; color: string }> = BAND_IDS.map(
  (id) => ({ id, color: GRADE_VIZ_COLORS[id] }),
);

/**
 * Per-term grade-band composition for the current scope: each term's counted
 * grades split into six buckets (failing → excellent) as percentages. Honors
 * the full filter set, ordered chronologically.
 */
export function computeGradeBandComposition(
  grades: CourseGradesData,
  filters: TrendFilters = {},
): GradeBandTerm[] {
  const season = filters.season ?? null;
  const byTerm = aggregateByKey(grades, season, (course, termId) =>
    courseMatchesTrendFilters(course.code, filters) ? termId : null,
  );

  const out: GradeBandTerm[] = [];
  for (const [termId, dist] of byTerm) {
    const viz = normalizeGradeVizDistribution(dist);
    if (!viz || viz.total <= 0) continue;
    const bands = emptyBands();
    for (const bucket of viz.buckets) {
      bands[bucket.id] = (bucket.count / viz.total) * 100;
    }
    const meta = decodeTermMeta(termId);
    out.push({ termId, year: meta.year, season: meta.season, total: viz.total, bands });
  }
  out.sort(
    (a, b) =>
      decodeTermMeta(a.termId).sortKey - decodeTermMeta(b.termId).sortKey || a.termId - b.termId,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Professor spread (who grades easier within a scope?)
// ---------------------------------------------------------------------------

export interface ProfessorSpreadRow {
  name: string;
  gpa: number | null;
  aPlusPct: number | null;
  volume: number;
  /** Distinct (course, term) offerings aggregated for this professor. */
  offerings: number;
}

export interface ProfessorSpreadOptions {
  /** Drop professors below this counted graded mass (default 30). */
  minVolume?: number;
  /** Keep only the N highest-volume professors (default 25). */
  limit?: number;
}

const DEFAULT_PROF_MIN_VOLUME = 30;
const DEFAULT_PROF_LIMIT = 25;

/**
 * Aggregate matched offerings per professor (by name) within the current scope,
 * honoring the full filter set. Professors below `minVolume` are dropped; the
 * highest-volume `limit` are kept, sorted by GPA descending (easiest first).
 */
export function computeProfessorSpread(
  grades: CourseGradesData,
  filters: TrendFilters = {},
  options: ProfessorSpreadOptions = {},
): ProfessorSpreadRow[] {
  const minVolume = options.minVolume ?? DEFAULT_PROF_MIN_VOLUME;
  const limit = options.limit ?? DEFAULT_PROF_LIMIT;
  const season = filters.season ?? null;

  const byProf = new Map<string, { dist: GradeDistribution; offerings: number }>();
  for (const course of grades.courses) {
    if (!courseMatchesTrendFilters(course.code, filters)) continue;
    for (const prof of course.sections) {
      const off = usableOffering(prof, season);
      if (!off) continue;
      const name = (prof.name ?? "").trim();
      if (!name) continue;
      let entry = byProf.get(name);
      if (!entry) {
        entry = { dist: {}, offerings: 0 };
        byProf.set(name, entry);
      }
      addInto(entry.dist, off.distribution);
      entry.offerings += 1;
    }
  }

  const out: ProfessorSpreadRow[] = [];
  for (const [name, entry] of byProf) {
    const volume = countedMass(entry.dist);
    if (volume < minVolume) continue;
    out.push({
      name,
      gpa: distributionGpa(entry.dist),
      aPlusPct: metricsForDistribution(entry.dist).aPlusPct,
      volume,
      offerings: entry.offerings,
    });
  }
  out.sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name));
  const limited = out.slice(0, limit);
  limited.sort((a, b) => (b.gpa ?? -1) - (a.gpa ?? -1) || b.volume - a.volume);
  return limited;
}
