import type { CourseGradesData, GradeDistribution } from "./dataTypes";
import { aPlusPercent, countedMass, distributionGpa } from "./gradeDistribution";
import { disciplineOf, levelOf, normalizeCourseCode } from "./utils/courseUtils";
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

/** Failing letter grades within the counted set (E = supplemental, F = fail). */
const FAILING_GRADES = ["E", "F"] as const;
const A_RANGE_GRADES = ["A-", "A", "A+"] as const;

export { countedMass };

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

/** Reject zero / non-finite PeopleSoft term ids. */
export function isValidTermId(termId: number): boolean {
  return Number.isFinite(termId) && termId !== 0;
}

/**
 * Validate a single professor offering against the standard aggregation filters
 * (finite non-zero term id, matching `season`, present object distribution) and
 * return its decoded term id + distribution, or `null` when it should be
 * skipped. Single source of truth for "is this offering in scope?" — shared by
 * every per-offering aggregation loop in {@link gradeTrends} and gradeAnalytics.
 */
export function usableOffering(
  prof: { termId?: number | string | null; distribution?: GradeDistribution | null },
  season: TermSeason | null,
): { termId: number; distribution: GradeDistribution } | null {
  const termId = Number(prof.termId);
  if (!isValidTermId(termId)) return null;
  if (season && decodeTermMeta(termId).season !== season) return null;
  const distribution = prof.distribution;
  if (!distribution || typeof distribution !== "object") return null;
  return { termId, distribution };
}

/** Get-or-create the distribution accumulator at `key`, merging `dist` into it. */
export function mergeDistributionInto<K>(
  map: Map<K, GradeDistribution>,
  key: K,
  dist: GradeDistribution,
): void {
  let acc = map.get(key);
  if (!acc) {
    acc = {};
    map.set(key, acc);
  }
  addInto(acc, dist);
}

/** Two-level variant of {@link mergeDistributionInto}: `key → termId → distribution`. */
export function mergeDistributionByTerm<K>(
  map: Map<K, Map<number, GradeDistribution>>,
  key: K,
  termId: number,
  dist: GradeDistribution,
): void {
  let terms = map.get(key);
  if (!terms) {
    terms = new Map();
    map.set(key, terms);
  }
  mergeDistributionInto(terms, termId, dist);
}

type GradeCourse = CourseGradesData["courses"][number];

/**
 * Walk every usable offering, yielding the bucket key (via `keyFor`) plus its
 * term id and distribution. Offerings whose `keyFor` returns `null` are skipped.
 * Shared iteration core for {@link aggregateByKey} / {@link aggregateByKeyAndTerm}.
 */
function* keyedOfferings<K>(
  grades: CourseGradesData,
  season: TermSeason | null,
  keyFor: (course: GradeCourse, termId: number) => K | null,
): Generator<{ key: K; termId: number; distribution: GradeDistribution }> {
  for (const course of grades.courses) {
    for (const prof of course.sections) {
      const off = usableOffering(prof, season);
      if (!off) continue;
      const key = keyFor(course, off.termId);
      if (key == null) continue;
      yield { key, termId: off.termId, distribution: off.distribution };
    }
  }
}

/**
 * Aggregate every usable offering into one distribution per bucket key. For each
 * in-scope offering, `keyFor(course, termId)` returns the bucket key, or `null`
 * to skip it (used for per-course / per-season inclusion filters). Single source
 * of truth for the one-level "iterate offerings → accumulate by key" loop.
 */
export function aggregateByKey<K>(
  grades: CourseGradesData,
  season: TermSeason | null,
  keyFor: (course: GradeCourse, termId: number) => K | null,
): Map<K, GradeDistribution> {
  const map = new Map<K, GradeDistribution>();
  for (const { key, distribution } of keyedOfferings(grades, season, keyFor)) {
    mergeDistributionInto(map, key, distribution);
  }
  return map;
}

/** Two-level variant of {@link aggregateByKey}: `key → termId → distribution`. */
export function aggregateByKeyAndTerm<K>(
  grades: CourseGradesData,
  season: TermSeason | null,
  keyFor: (course: GradeCourse, termId: number) => K | null,
): Map<K, Map<number, GradeDistribution>> {
  const map = new Map<K, Map<number, GradeDistribution>>();
  for (const { key, termId, distribution } of keyedOfferings(grades, season, keyFor)) {
    mergeDistributionByTerm(map, key, termId, distribution);
  }
  return map;
}

/**
 * Bucket-key factory for aggregations keyed by a course's discipline, honoring an
 * optional course-level filter. Shared by the discipline comparison + leaderboard.
 */
export function disciplineKeyFor(level: number | null): (course: GradeCourse) => string | null {
  return (course) => {
    const discipline = disciplineOf(course.code);
    if (!discipline) return null;
    if (level != null && levelOf(course.code) !== level) return null;
    return discipline;
  };
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

  const byTerm = aggregateByKey(grades, season, (course, termId) =>
    courseMatchesTrendFilters(course.code, filters) ? termId : null,
  );

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
  const byDiscipline = aggregateByKeyAndTerm(grades, season, disciplineKeyFor(level));

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
  const byCourse = aggregateByKeyAndTerm(grades, season, (course) =>
    courseMatchesTrendFilters(course.code, filters) ? normalizeCourseCode(course.code) : null,
  );

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
    for (const prof of course.sections) {
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
