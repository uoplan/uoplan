import type { CourseGradesData, GradeDistribution } from "./dataTypes";
import { GRADE_POINTS, aPlusPercent, distributionGpa } from "./gradeDistribution";
import { getCourseLevel, normalizeCourseCode, parseCourseCode } from "./utils/courseUtils";
import type { ProgramCourseFilter } from "./programTrends";
import { programFilterMatches } from "./programTrends";

/**
 * Aggregate uOttawa grade analytics over time, built from the runtime grades
 * dataset (`grades.pb` → {@link CourseGradesData}). Everything here is pure and
 * unit-tested; the web layer handles loading, memoisation, and localisation.
 *
 * GPA uses the shared 10-point scale ({@link GRADE_POINTS}, policy A-3.1), so all
 * GPA values returned here are on a 0–10 scale.
 */

export type TermSeason = "winter" | "springSummer" | "fall";

export interface TermMeta {
  termId: number;
  year: number;
  /** PeopleSoft session digit (1 = Winter, 5 = Spring/Summer, 9 = Fall). */
  seasonDigit: number;
  season: TermSeason | null;
  /** Monotonic ordering key (Winter < Spring/Summer < Fall within a year). */
  sortKey: number;
}

const SEASON_BY_DIGIT: Record<number, TermSeason> = {
  1: "winter",
  5: "springSummer",
  9: "fall",
};

const SEASON_RANK: Record<TermSeason, number> = {
  winter: 0,
  springSummer: 1,
  fall: 2,
};

/**
 * Decode a PeopleSoft-style uOttawa term id (e.g. `2179` → Fall 2017).
 * Format: `2` + `YY` (last two digits of year) + session digit.
 */
export function decodeTermMeta(termId: number): TermMeta {
  const n = Math.abs(Math.floor(Number(termId)));
  const s = String(n);
  if (s.length !== 4 || s[0] !== "2") {
    return { termId: n, year: 0, seasonDigit: 0, season: null, sortKey: 0 };
  }
  const yy = Number.parseInt(s.slice(1, 3), 10);
  const seasonDigit = Number.parseInt(s[3], 10);
  const year = Number.isFinite(yy) ? 2000 + yy : 0;
  const season = SEASON_BY_DIGIT[seasonDigit] ?? null;
  const sortKey = season ? year * 10 + SEASON_RANK[season] : year * 10;
  return { termId: n, year, seasonDigit, season, sortKey };
}

/** Discipline (subject) prefix of a course code, e.g. `PSY 1101` → `PSY`. */
export function disciplineOf(code: string): string | null {
  return parseCourseCode(code)?.discipline ?? null;
}

/** Course level bucket (1000, 2000, …) of a course code, or null. */
export function levelOf(code: string): number | null {
  return getCourseLevel(code);
}

/** Letter grades that count toward GPA / graded totals (the 10-point scale). */
const COUNTED_GRADES = Object.keys(GRADE_POINTS);
/** Failing letter grades within the counted set (E = supplemental, F = fail). */
const FAILING_GRADES = ["E", "F"] as const;
const A_RANGE_GRADES = ["A-", "A", "A+"] as const;

/** Summed count of grades that contribute to GPA/averages (excludes P/S/ABS/EIN…). */
export function countedMass(dist: GradeDistribution): number {
  let total = 0;
  for (const letter of COUNTED_GRADES) {
    const n = Number(dist[letter] ?? 0);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

function sumGrades(dist: GradeDistribution, grades: readonly string[]): number {
  let total = 0;
  for (const letter of grades) {
    const n = Number(dist[letter] ?? 0);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

export function addInto(target: GradeDistribution, source: GradeDistribution): void {
  for (const [k, v] of Object.entries(source)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    target[k] = (target[k] ?? 0) + n;
  }
}

export interface TrendFilters {
  /** Discipline (subject) code, e.g. `PSY`. */
  discipline?: string | null;
  /** Course level bucket, e.g. `1000`. */
  level?: number | null;
  /** Academic season. */
  season?: TermSeason | null;
  /**
   * Restrict to a program's estimated core course set (concrete required
   * courses + discipline-scoped elective pools). Intersects with the other
   * filters. See {@link buildProgramCourseFilter}.
   */
  programFilter?: ProgramCourseFilter | null;
}

/**
 * Code-level trend filter: true when `code` passes the discipline / level /
 * program filters. Season is a per-term property, so it is filtered where terms
 * are iterated (not here). Shared by {@link computeGradeTrends} and
 * {@link computeCourseLeaderboard} so the chart and the per-course leaderboard
 * always agree on which courses are in scope.
 */
export function courseMatchesTrendFilters(code: string, filters: TrendFilters): boolean {
  const discipline = filters.discipline ? filters.discipline.toUpperCase() : null;
  if (discipline && disciplineOf(code) !== discipline) return false;
  if (filters.level != null && levelOf(code) !== filters.level) return false;
  if (filters.programFilter && !programFilterMatches(filters.programFilter, code)) return false;
  return true;
}

export interface TrendPoint {
  termId: number;
  year: number;
  season: TermSeason | null;
  sortKey: number;
  /** Mean GPA on the 0–10 scale, or null when no counted grades. */
  gpa: number | null;
  /** Percent of graded students who received A+ (0–100), or null. */
  aPlusPct: number | null;
  /** Percent of graded students in the A range (A-/A/A+), or null. */
  aRangePct: number | null;
  /** Percent of graded students who passed (grade ≥ D), or null. */
  passPct: number | null;
  /** Counted graded mass for the term (number of graded results). */
  volume: number;
}

export interface TrendSeries {
  points: TrendPoint[];
}

export function metricsForDistribution(
  dist: GradeDistribution,
): Omit<TrendPoint, "termId" | "year" | "season" | "sortKey"> {
  const mass = countedMass(dist);
  if (mass <= 0) {
    return { gpa: null, aPlusPct: null, aRangePct: null, passPct: null, volume: 0 };
  }
  const failing = sumGrades(dist, FAILING_GRADES);
  const aRange = sumGrades(dist, A_RANGE_GRADES);
  return {
    gpa: distributionGpa(dist),
    aPlusPct: aPlusPercent(dist),
    aRangePct: (aRange / mass) * 100,
    passPct: ((mass - failing) / mass) * 100,
    volume: mass,
  };
}

/**
 * Aggregate per-term grade metrics across every offering that matches `filters`.
 * Returns one point per term that has counted grades, ordered chronologically.
 */
export function computeGradeTrends(
  grades: CourseGradesData,
  filters: TrendFilters = {},
): TrendSeries {
  const season = filters.season ?? null;

  const byTerm = new Map<number, GradeDistribution>();

  for (const course of grades.courses) {
    if (!courseMatchesTrendFilters(course.code, filters)) continue;

    for (const prof of course.professors) {
      const termId = Number(prof.termId);
      if (!Number.isFinite(termId) || termId === 0) continue;
      const meta = decodeTermMeta(termId);
      if (season && meta.season !== season) continue;
      if (!prof.distribution || typeof prof.distribution !== "object") continue;

      let acc = byTerm.get(termId);
      if (!acc) {
        acc = {};
        byTerm.set(termId, acc);
      }
      addInto(acc, prof.distribution);
    }
  }

  const points: TrendPoint[] = [];
  for (const [termId, dist] of byTerm) {
    const metrics = metricsForDistribution(dist);
    if (metrics.volume <= 0) continue;
    const meta = decodeTermMeta(termId);
    points.push({
      termId,
      year: meta.year,
      season: meta.season,
      sortKey: meta.sortKey,
      ...metrics,
    });
  }
  points.sort((a, b) => a.sortKey - b.sortKey || a.termId - b.termId);
  return { points };
}

export interface DisciplineTrend {
  discipline: string;
  /** GPA (0–10) of the most recent term meeting the volume guard. */
  currentGpa: number | null;
  /** GPA (0–10) of the earliest term meeting the volume guard. */
  earliestGpa: number | null;
  /** currentGpa − earliestGpa (positive = grade inflation), or null. */
  gpaDelta: number | null;
  /** A+ percentage of the most recent qualifying term, or null. */
  currentAPlusPct: number | null;
  /** Total counted graded mass across all terms. */
  totalVolume: number;
  /** Number of terms that met the volume guard. */
  qualifyingTerms: number;
  firstYear: number | null;
  lastYear: number | null;
}

export interface LeaderboardOptions {
  /** Minimum counted graded mass for a term to count toward the trend. */
  minTermVolume?: number;
  /** Minimum number of qualifying terms required to report a GPA delta. */
  minTerms?: number;
  /** Restrict to a single course level bucket (1000, 2000, …). */
  level?: number | null;
  /** Restrict to a single academic season. */
  season?: TermSeason | null;
}

const DEFAULT_MIN_TERM_VOLUME = 50;
const DEFAULT_MIN_TERMS = 2;
/** Per-term volume guard for the finer-grained per-course leaderboard. */
const DEFAULT_COURSE_MIN_TERM_VOLUME = 5;

interface TermSeriesSummary {
  currentGpa: number | null;
  earliestGpa: number | null;
  gpaDelta: number | null;
  currentAPlusPct: number | null;
  totalVolume: number;
  qualifyingTerms: number;
  firstYear: number | null;
  lastYear: number | null;
}

/**
 * Reduce a `termId → distribution` map to an earliest-vs-latest GPA summary.
 * Terms below `minTermVolume` graded results are ignored to limit small-sample
 * noise. When `keepAnyData` is set and no term clears the guard, every term with
 * graded data is used instead (so a row is still produced for any group that has
 * grades at all). Returns null when there is no graded data.
 */
function summarizeTermSeries(
  terms: Map<number, GradeDistribution>,
  minTermVolume: number,
  minTerms: number,
  keepAnyData = false,
): TermSeriesSummary | null {
  let totalVolume = 0;
  const all: Array<{ sortKey: number; year: number; dist: GradeDistribution }> = [];
  let qualifying: Array<{ sortKey: number; year: number; dist: GradeDistribution }> = [];

  for (const [termId, dist] of terms) {
    const mass = countedMass(dist);
    totalVolume += mass;
    if (mass <= 0) continue;
    const meta = decodeTermMeta(termId);
    const entry = { sortKey: meta.sortKey, year: meta.year, dist };
    all.push(entry);
    if (mass >= minTermVolume) qualifying.push(entry);
  }

  if (qualifying.length === 0) {
    if (!keepAnyData || all.length === 0) return null;
    qualifying = all;
  }
  qualifying.sort((a, b) => a.sortKey - b.sortKey);

  const earliest = qualifying[0];
  const latest = qualifying[qualifying.length - 1];
  const earliestGpa = distributionGpa(earliest.dist);
  const currentGpa = distributionGpa(latest.dist);
  const hasDelta = qualifying.length >= minTerms && earliestGpa != null && currentGpa != null;

  return {
    currentGpa,
    earliestGpa,
    gpaDelta: hasDelta ? currentGpa - earliestGpa : null,
    currentAPlusPct: aPlusPercent(latest.dist),
    totalVolume,
    qualifyingTerms: qualifying.length,
    firstYear: earliest.year || null,
    lastYear: latest.year || null,
  };
}

/**
 * Per-discipline grade-inflation summary: earliest vs latest qualifying-term GPA.
 * Terms below `minTermVolume` graded results are ignored to avoid small-sample
 * noise; disciplines with no qualifying term are dropped. The optional
 * `level`/`season` filters narrow the aggregation. Callers sort the result
 * (e.g. by `gpaDelta` for inflation, or `currentGpa` for easiest/hardest now).
 */
export function computeDisciplineLeaderboard(
  grades: CourseGradesData,
  options: LeaderboardOptions = {},
): DisciplineTrend[] {
  const minTermVolume = options.minTermVolume ?? DEFAULT_MIN_TERM_VOLUME;
  const minTerms = options.minTerms ?? DEFAULT_MIN_TERMS;
  const level = options.level ?? null;
  const season = options.season ?? null;

  // discipline → termId → summed distribution
  const byDiscipline = new Map<string, Map<number, GradeDistribution>>();

  for (const course of grades.courses) {
    const discipline = disciplineOf(course.code);
    if (!discipline) continue;
    if (level != null && levelOf(course.code) !== level) continue;
    for (const prof of course.professors) {
      const termId = Number(prof.termId);
      if (!Number.isFinite(termId) || termId === 0) continue;
      if (season && decodeTermMeta(termId).season !== season) continue;
      if (!prof.distribution || typeof prof.distribution !== "object") continue;
      let terms = byDiscipline.get(discipline);
      if (!terms) {
        terms = new Map();
        byDiscipline.set(discipline, terms);
      }
      let acc = terms.get(termId);
      if (!acc) {
        acc = {};
        terms.set(termId, acc);
      }
      addInto(acc, prof.distribution);
    }
  }

  const out: DisciplineTrend[] = [];
  for (const [discipline, terms] of byDiscipline) {
    const summary = summarizeTermSeries(terms, minTermVolume, minTerms);
    if (!summary) continue;
    out.push({ discipline, ...summary });
  }

  return out;
}

/** Per-course variant of {@link DisciplineTrend}, keyed by normalized course code. */
export interface CourseTrend extends TermSeriesSummary {
  /** Normalized course code, e.g. `CSI 2110`. */
  code: string;
}

/**
 * Per-course grade-inflation summary scoped by the same filters as
 * {@link computeGradeTrends} (discipline / level / season / programFilter), so
 * the rows match the courses the chart is computed from. Every matched course
 * with graded data yields a row (sub-guard courses keep `gpaDelta: null`).
 */
export function computeCourseLeaderboard(
  grades: CourseGradesData,
  filters: TrendFilters = {},
  options: LeaderboardOptions = {},
): CourseTrend[] {
  const minTermVolume = options.minTermVolume ?? DEFAULT_COURSE_MIN_TERM_VOLUME;
  const minTerms = options.minTerms ?? DEFAULT_MIN_TERMS;
  const season = filters.season ?? null;

  // normalized course code → termId → summed distribution
  const byCourse = new Map<string, Map<number, GradeDistribution>>();

  for (const course of grades.courses) {
    if (!courseMatchesTrendFilters(course.code, filters)) continue;
    const code = normalizeCourseCode(course.code);
    for (const prof of course.professors) {
      const termId = Number(prof.termId);
      if (!Number.isFinite(termId) || termId === 0) continue;
      if (season && decodeTermMeta(termId).season !== season) continue;
      if (!prof.distribution || typeof prof.distribution !== "object") continue;
      let terms = byCourse.get(code);
      if (!terms) {
        terms = new Map();
        byCourse.set(code, terms);
      }
      let acc = terms.get(termId);
      if (!acc) {
        acc = {};
        terms.set(termId, acc);
      }
      addInto(acc, prof.distribution);
    }
  }

  const out: CourseTrend[] = [];
  for (const [code, terms] of byCourse) {
    const summary = summarizeTermSeries(terms, minTermVolume, minTerms, true);
    if (!summary) continue;
    out.push({ code, ...summary });
  }

  return out;
}

export interface DisciplineVolume {
  discipline: string;
  volume: number;
}

/**
 * Disciplines present in the grades dataset, with total counted graded mass,
 * sorted by volume desc. Useful for populating a discipline filter with only
 * disciplines that actually have grade data.
 */
export function availableDisciplines(grades: CourseGradesData): DisciplineVolume[] {
  const totals = new Map<string, number>();
  for (const course of grades.courses) {
    const discipline = disciplineOf(course.code);
    if (!discipline) continue;
    let mass = 0;
    for (const prof of course.professors) {
      if (!prof.distribution || typeof prof.distribution !== "object") continue;
      mass += countedMass(prof.distribution);
    }
    if (mass <= 0) continue;
    totals.set(discipline, (totals.get(discipline) ?? 0) + mass);
  }
  return [...totals.entries()]
    .map(([discipline, volume]) => ({ discipline, volume }))
    .sort((a, b) => b.volume - a.volume || a.discipline.localeCompare(b.discipline));
}
