import {
  computeCourseLeaderboard,
  computeDisciplineLeaderboard,
  type CourseTrend,
  type DisciplineTrend,
  type LeaderboardOptions,
  type TermSeason,
  type TrendFilters,
} from "@uoplan/core/gradeTrends";

type CourseGradesData = Parameters<typeof computeDisciplineLeaderboard>[0];

export type TrendsLeaderboardSort = "rise" | "easy" | "hard";
export type TrendsLeaderboardScope = "discipline" | "course";

export interface TrendsLeaderboardRow {
  key: string;
  label: string;
  name: string | null;
  scope: TrendsLeaderboardScope;
  currentGpa: number | null;
  gpaDelta: number | null;
  firstYear: number | null;
  lastYear: number | null;
  totalVolume: number;
  qualifyingTerms: number;
}

export interface TrendsLeaderboardOptions {
  sort?: TrendsLeaderboardSort;
  discipline?: string | null;
  level?: number | null;
  season?: TermSeason | null;
  disciplineNameByCode?: ReadonlyMap<string, string>;
  courseTitleByCode?: ReadonlyMap<string, string>;
  limit?: number;
  minTermVolume?: number;
  courseMinTermVolume?: number;
  minTerms?: number;
}

const DEFAULT_DISCIPLINE_LIMIT = 10;
const DEFAULT_DISCIPLINE_MIN_TERM_VOLUME = 50;
const DEFAULT_COURSE_MIN_TERM_VOLUME = 5;

function normalizeDiscipline(discipline: string | null | undefined): string | null {
  const value = discipline?.trim().toUpperCase();
  return value ? value : null;
}

function disciplineRow(
  trend: DisciplineTrend,
  disciplineNameByCode?: ReadonlyMap<string, string>,
): TrendsLeaderboardRow {
  return {
    key: trend.discipline,
    label: trend.discipline,
    name: disciplineNameByCode?.get(trend.discipline) ?? null,
    scope: "discipline",
    currentGpa: trend.currentGpa,
    gpaDelta: trend.gpaDelta,
    firstYear: trend.firstYear,
    lastYear: trend.lastYear,
    totalVolume: trend.totalVolume,
    qualifyingTerms: trend.qualifyingTerms,
  };
}

function courseRow(
  trend: CourseTrend,
  courseTitleByCode?: ReadonlyMap<string, string>,
): TrendsLeaderboardRow {
  return {
    key: trend.code,
    label: trend.code,
    name: courseTitleByCode?.get(trend.code) ?? null,
    scope: "course",
    currentGpa: trend.currentGpa,
    gpaDelta: trend.gpaDelta,
    firstYear: trend.firstYear,
    lastYear: trend.lastYear,
    totalVolume: trend.totalVolume,
    qualifyingTerms: trend.qualifyingTerms,
  };
}

function compareLabels(a: TrendsLeaderboardRow, b: TrendsLeaderboardRow): number {
  return a.label.localeCompare(b.label);
}

function compareNullableNumber(
  a: TrendsLeaderboardRow,
  b: TrendsLeaderboardRow,
  valueFor: (row: TrendsLeaderboardRow) => number | null,
  direction: "asc" | "desc",
): number {
  const av = valueFor(a);
  const bv = valueFor(b);
  if (av == null && bv == null) return compareLabels(a, b);
  if (av == null) return 1;
  if (bv == null) return -1;
  const diff = direction === "desc" ? bv - av : av - bv;
  return diff || compareLabels(a, b);
}

function rankedRows(
  rows: TrendsLeaderboardRow[],
  sort: TrendsLeaderboardSort,
  scope: TrendsLeaderboardScope,
): TrendsLeaderboardRow[] {
  const ranked = [...rows];
  if (sort === "rise") {
    const sortable = scope === "discipline" ? ranked.filter((row) => row.gpaDelta != null) : ranked;
    return sortable.sort((a, b) => compareNullableNumber(a, b, (row) => row.gpaDelta, "desc"));
  }
  if (sort === "easy") {
    return ranked
      .filter((row) => row.currentGpa != null)
      .sort((a, b) => compareNullableNumber(a, b, (row) => row.currentGpa, "desc"));
  }
  return ranked
    .filter((row) => row.currentGpa != null)
    .sort((a, b) => compareNullableNumber(a, b, (row) => row.currentGpa, "asc"));
}

export function buildTrendsLeaderboard(
  grades: CourseGradesData,
  options: TrendsLeaderboardOptions = {},
): TrendsLeaderboardRow[] {
  const discipline = normalizeDiscipline(options.discipline);
  const sort = options.sort ?? "rise";

  if (discipline) {
    const filters: TrendFilters = {
      discipline,
      level: options.level ?? null,
      season: options.season ?? null,
    };
    const leaderboardOptions: LeaderboardOptions = {
      minTermVolume: options.courseMinTermVolume ?? DEFAULT_COURSE_MIN_TERM_VOLUME,
      minTerms: options.minTerms,
    };
    const rows = computeCourseLeaderboard(grades, filters, leaderboardOptions).map((trend) =>
      courseRow(trend, options.courseTitleByCode),
    );
    const ranked = rankedRows(rows, sort, "course");
    return options.limit == null ? ranked : ranked.slice(0, options.limit);
  }

  const leaderboardOptions: LeaderboardOptions = {
    minTermVolume: options.minTermVolume ?? DEFAULT_DISCIPLINE_MIN_TERM_VOLUME,
    minTerms: options.minTerms,
    level: options.level ?? null,
    season: options.season ?? null,
  };
  const rows = computeDisciplineLeaderboard(grades, leaderboardOptions).map((trend) =>
    disciplineRow(trend, options.disciplineNameByCode),
  );
  return rankedRows(rows, sort, "discipline").slice(0, options.limit ?? DEFAULT_DISCIPLINE_LIMIT);
}

export function formatLeaderboardGpa(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

export function formatLeaderboardDelta(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function formatLeaderboardSpan(row: Pick<TrendsLeaderboardRow, "firstYear" | "lastYear">) {
  return row.firstYear && row.lastYear ? `${row.firstYear}–${row.lastYear}` : "—";
}
