/**
 * Native Trends view-models, computed from the live decoded grades dataset
 * (`grades.pb` → {@link CourseGradesData}). Everything here is pure and reuses
 * the SHARED analytics in `@uoplan/core/gradeTrends` (the same helpers the web
 * Trends pages use), so the native dashboard stays 1:1 with web. The hook layer
 * (`useTrends`) memoises these over the app data bundle.
 */
import type { CourseGradesData, GradeDistribution } from "@uoplan/core/dataTypes";
import {
  computeDisciplineYearHeatmap,
  computeGradeBandComposition,
  computeProfessorSpread,
  type DisciplineHeatmap,
} from "@uoplan/core/gradeAnalytics";
import { type GradeVizBucketId } from "@uoplan/core/gradeDistribution";
import {
  addInto,
  aggregateByKey,
  courseMatchesTrendFilters,
  computeDisciplineLeaderboard,
  computeGradeTrends,
  decodeTermMeta,
  metricsForDistribution,
  type TermSeason,
  type TrendFilters,
} from "@uoplan/core/gradeTrends";
import type { ProgramCourseFilter } from "@uoplan/core/programTrends";
import { disciplineOf, levelOf, normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface TrendBarPoint extends SeriesPoint {
  volume: number;
}

export interface SeasonBarPoint extends TrendBarPoint {
  season: TermSeason;
}

export interface LevelBarPoint extends TrendBarPoint {
  level: number;
}

export interface VolumeGpaPoint {
  code: string;
  label: string;
  x: number;
  y: number;
  volume: number;
  gpa: number;
}

export interface ProfessorSpreadPoint extends TrendBarPoint {
  name: string;
  offerings: number;
}

export interface GradeBandSeries {
  id: GradeVizBucketId;
  label: string;
  latest: number;
  data: SeriesPoint[];
}

export interface Riser {
  code: string;
  prefix: string;
  title: string;
  delta: number;
}

export interface TrendsOverview {
  latestTerm: number;
  change: number;
  terms: number;
  graded: number;
}

const SEASON_LABEL: Record<TermSeason, string> = {
  winter: "Winter",
  springSummer: "Spring/Summer",
  fall: "Fall",
};

const COURSE_CARD_SEASON_LABEL: Record<TermSeason, string> = {
  winter: "Winter",
  springSummer: "Spring/summer",
  fall: "Fall",
};

const SEASON_INITIAL: Record<TermSeason, string> = {
  winter: "W",
  springSummer: "S",
  fall: "F",
};

const GRADE_BAND_LABEL: Record<GradeVizBucketId, string> = {
  red: "Failing",
  amber: "Low pass",
  yellow: "Mid pass",
  blue: "Good",
  teal: "Near excellent",
  green: "Excellent",
  grey: "Withdrew",
};

const GRADE_BAND_ORDER: GradeVizBucketId[] = [
  "red",
  "amber",
  "yellow",
  "blue",
  "teal",
  "green",
  "grey",
];

const SEASON_ORDER: TermSeason[] = ["fall", "winter", "springSummer"];
const MAX_LEVEL_BUCKET = 5000;
const DEFAULT_LEVEL_MIN_VOLUME = 50;
const DEFAULT_SCATTER_MIN_VOLUME = 30;
const DEFAULT_PROF_MIN_VOLUME = 30;

function roundMetric(value: number | null | undefined, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function courseOnlyFilter(code: string): ProgramCourseFilter {
  return { codes: new Set([normalizeCourseCode(code)]), pools: [] };
}

function selectedCourseFilters(code: string): TrendFilters {
  return { programFilter: courseOnlyFilter(code) };
}

/** Canonical term label, e.g. `Fall 2017`. Falls back to the raw id. */
export function formatTermLabel(termId: number): string {
  const meta = decodeTermMeta(termId);
  if (!meta.season || !meta.year) return String(termId);
  return `${SEASON_LABEL[meta.season]} ${meta.year}`;
}

/** Compact axis label, e.g. `F17`. Falls back to the raw id. */
export function formatTermLabelShort(termId: number): string {
  const meta = decodeTermMeta(termId);
  if (!meta.season || !meta.year) return String(termId);
  return `${SEASON_INITIAL[meta.season]}${String(meta.year).slice(-2)}`;
}

/** University-wide term-GPA series (one point per term with counted grades). */
export function overallTermSeries(grades: CourseGradesData): SeriesPoint[] {
  return computeGradeTrends(grades).points.map((p) => ({
    label: formatTermLabelShort(p.termId),
    value: Number((p.gpa ?? 0).toFixed(2)),
  }));
}

/** Headline overview metrics: latest GPA, change since the first term, etc. */
export function buildOverview(grades: CourseGradesData): TrendsOverview {
  const points = computeGradeTrends(grades).points;
  const withGpa = points.filter((p) => p.gpa != null);
  const latest = withGpa.at(-1)?.gpa ?? 0;
  const first = withGpa[0]?.gpa ?? 0;
  const graded = points.reduce((sum, p) => sum + p.volume, 0);
  return {
    latestTerm: Number(latest.toFixed(2)),
    change: Number((latest - first).toFixed(1)),
    terms: points.length,
    graded,
  };
}

/** Average grade per discipline (most-recent qualifying term), highest first. */
export function disciplineGpa(grades: CourseGradesData, limit = 8): SeriesPoint[] {
  return computeDisciplineLeaderboard(grades)
    .filter((d) => d.currentGpa != null)
    .sort((a, b) => (b.currentGpa ?? 0) - (a.currentGpa ?? 0))
    .slice(0, limit)
    .map((d) => ({ label: d.discipline, value: Number((d.currentGpa ?? 0).toFixed(2)) }));
}

/** Volume-weighted mean GPA by season — a "choosing courses" signal. */
export function seasonGpa(
  grades: CourseGradesData,
): { label: string; value: number; season: TermSeason }[] {
  const seasons: TermSeason[] = ["fall", "winter", "springSummer"];
  return seasons.map((season) => {
    const points = computeGradeTrends(grades, { season }).points;
    let weighted = 0;
    let total = 0;
    for (const p of points) {
      if (p.gpa == null || p.volume <= 0) continue;
      weighted += p.gpa * p.volume;
      total += p.volume;
    }
    return {
      label: SEASON_LABEL[season],
      value: total > 0 ? Number((weighted / total).toFixed(1)) : 0,
      season,
    };
  });
}

/** Biggest grade risers by discipline (current − earliest GPA), highest first. */
export function buildRisers(
  grades: CourseGradesData,
  nameByDiscipline: Map<string, string>,
  limit = 8,
): Riser[] {
  return computeDisciplineLeaderboard(grades)
    .filter((d) => d.gpaDelta != null && d.gpaDelta > 0)
    .sort((a, b) => (b.gpaDelta ?? 0) - (a.gpaDelta ?? 0))
    .slice(0, limit)
    .map((d) => ({
      code: d.discipline,
      prefix: d.discipline,
      title: nameByDiscipline.get(d.discipline) ?? d.discipline,
      delta: Number((d.gpaDelta ?? 0).toFixed(1)),
    }));
}

/** Per-course term-GPA series for the selected course, chronological. */
export function courseTermSeries(grades: CourseGradesData, code: string): SeriesPoint[] {
  const byTerm = new Map<number, GradeDistribution>();
  for (const course of grades.courses) {
    if (course.code !== code) continue;
    for (const prof of course.sections) {
      if (!prof.distribution) continue;
      const existing = byTerm.get(prof.termId) ?? ({} as GradeDistribution);
      addInto(existing, prof.distribution);
      byTerm.set(prof.termId, existing);
    }
  }
  const points: { sortKey: number; termId: number; label: string; value: number }[] = [];
  for (const [termId, dist] of byTerm) {
    const metrics = metricsForDistribution(dist);
    if (metrics.volume <= 0 || metrics.gpa == null) continue;
    points.push({
      sortKey: decodeTermMeta(termId).sortKey,
      termId,
      label: formatTermLabelShort(termId),
      value: Number(metrics.gpa.toFixed(2)),
    });
  }
  points.sort((a, b) => a.sortKey - b.sortKey || a.termId - b.termId);
  return points.map((p) => ({ label: p.label, value: p.value }));
}

/** Grade-band composition over time for the selected course, one series per band. */
export function courseGradeBandSeries(grades: CourseGradesData, code: string): GradeBandSeries[] {
  const terms = computeGradeBandComposition(grades, selectedCourseFilters(code));
  return GRADE_BAND_ORDER.map((id) => {
    const data = terms.map((term) => ({
      label: formatTermLabelShort(term.termId),
      value: Number(term.bands[id].toFixed(2)),
    }));
    return {
      id,
      label: GRADE_BAND_LABEL[id],
      latest: data.at(-1)?.value ?? 0,
      data,
    };
  });
}

/** GPA by academic season for the selected course. */
export function courseSeasonComparison(grades: CourseGradesData, code: string): SeasonBarPoint[] {
  const filters = selectedCourseFilters(code);
  const bySeason = aggregateByKey(grades, null, (course, termId) => {
    if (!courseMatchesTrendFilters(course.code, filters)) return null;
    return decodeTermMeta(termId).season;
  });

  return SEASON_ORDER.flatMap((season) => {
    const dist = bySeason.get(season);
    if (!dist) return [];
    const metrics = metricsForDistribution(dist);
    const value = roundMetric(metrics.gpa);
    if (metrics.volume <= 0 || value == null) return [];
    return [{ season, label: COURSE_CARD_SEASON_LABEL[season], value, volume: metrics.volume }];
  });
}

/** GPA by course level within the selected course's discipline. */
export function disciplineLevelComparison(grades: CourseGradesData, code: string): LevelBarPoint[] {
  const discipline = disciplineOf(code);
  if (!discipline) return [];
  const byLevel = aggregateByKey(grades, null, (course) => {
    if (disciplineOf(course.code) !== discipline) return null;
    const level = levelOf(course.code);
    return level == null ? null : Math.min(level, MAX_LEVEL_BUCKET);
  });

  return [...byLevel.entries()]
    .flatMap(([level, dist]) => {
      const metrics = metricsForDistribution(dist);
      const value = roundMetric(metrics.gpa);
      if (metrics.volume < DEFAULT_LEVEL_MIN_VOLUME || value == null) return [];
      return [
        {
          level,
          label: level >= MAX_LEVEL_BUCKET ? `${MAX_LEVEL_BUCKET}+` : String(level),
          value,
          volume: metrics.volume,
        },
      ];
    })
    .sort((a, b) => a.level - b.level);
}

/** Popularity (graded volume) vs GPA for courses in the selected course's discipline. */
export function disciplineCourseScatter(grades: CourseGradesData, code: string): VolumeGpaPoint[] {
  const discipline = disciplineOf(code);
  if (!discipline) return [];
  const byCourse = aggregateByKey(grades, null, (course) =>
    disciplineOf(course.code) === discipline ? normalizeCourseCode(course.code) : null,
  );

  return [...byCourse.entries()]
    .flatMap(([courseCode, dist]) => {
      const metrics = metricsForDistribution(dist);
      const gpa = roundMetric(metrics.gpa);
      if (metrics.volume < DEFAULT_SCATTER_MIN_VOLUME || gpa == null) return [];
      return [
        {
          code: courseCode,
          label: courseCode,
          x: metrics.volume,
          y: gpa,
          volume: metrics.volume,
          gpa,
        },
      ];
    })
    .sort((a, b) => b.volume - a.volume || a.code.localeCompare(b.code));
}

/** Per-professor GPA spread for the selected course. */
export function courseProfessorSpread(
  grades: CourseGradesData,
  code: string,
  limit = 14,
): ProfessorSpreadPoint[] {
  return computeProfessorSpread(grades, selectedCourseFilters(code), {
    minVolume: DEFAULT_PROF_MIN_VOLUME,
    limit,
  }).flatMap((row) => {
    const value = roundMetric(row.gpa);
    if (value == null) return [];
    return [
      { name: row.name, label: row.name, value, volume: row.volume, offerings: row.offerings },
    ];
  });
}

/** Re-exported for the native heatmap component + view-model consumers. */
export type { DisciplineHeatmap } from "@uoplan/core/gradeAnalytics";

/**
 * Discipline × year GPA heatmap — a dense view of how each subject's grades
 * drift over time (cross-discipline, mirrors the web `DisciplineHeatmapCard`).
 * Capped at the 12 highest-volume disciplines so the grid stays phone-friendly.
 */
export function disciplineHeatmap(grades: CourseGradesData): DisciplineHeatmap {
  return computeDisciplineYearHeatmap(grades, { topDisciplines: 12 });
}
