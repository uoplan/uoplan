import { distributionGpa } from "@uoplan/core";
import type { ExploreCourseSearchEntry, ExploreProfessorSearchEntry } from "./gradesSearch";

export type ExploreFilterLevel = 1000 | 2000 | 3000 | 4000 | 5000;
export type ExploreFilterDifficulty = "easy" | "moderate" | "tough";
export type ExploreSortKey = "relevance" | "avgGrade" | "courseCode" | "profRating";
export type ExploreSortDir = "asc" | "desc";
export type ExploreSearchParams = {
  q: string | undefined;
  levels: string | undefined;
  langs: string | undefined;
  disc: string | undefined;
  difficulty: string | undefined;
  minRating: string | undefined;
  sort: string | undefined;
  dir: string | undefined;
};

export function validateExploreSearch(search: Record<string, unknown>): ExploreSearchParams {
  return {
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
    levels:
      typeof search.levels === "string" && search.levels.length > 0 ? search.levels : undefined,
    langs: typeof search.langs === "string" && search.langs.length > 0 ? search.langs : undefined,
    disc: typeof search.disc === "string" && search.disc.length > 0 ? search.disc : undefined,
    difficulty:
      typeof search.difficulty === "string" && search.difficulty.length > 0
        ? search.difficulty
        : undefined,
    minRating:
      typeof search.minRating === "string" && search.minRating.length > 0
        ? search.minRating
        : undefined,
    sort: typeof search.sort === "string" && search.sort.length > 0 ? search.sort : undefined,
    dir: typeof search.dir === "string" && search.dir.length > 0 ? search.dir : undefined,
  };
}

export const EMPTY_EXPLORE_SEARCH: ExploreSearchParams = {
  q: undefined,
  levels: undefined,
  langs: undefined,
  disc: undefined,
  difficulty: undefined,
  minRating: undefined,
  sort: undefined,
  dir: undefined,
};

export type ExploreFilterState = {
  levels: ExploreFilterLevel[];
  languages: ("en" | "fr")[];
  disciplines: string[];
  difficulty: ExploreFilterDifficulty | null;
  minRating: number | null;
  sortKey: ExploreSortKey;
  sortDir: ExploreSortDir;
};

export const EMPTY_FILTERS: ExploreFilterState = {
  levels: [],
  languages: [],
  disciplines: [],
  difficulty: null,
  minRating: null,
  sortKey: "relevance",
  sortDir: "desc",
};

export function hasActiveFilters(f: ExploreFilterState): boolean {
  return (
    f.levels.length > 0 ||
    f.languages.length > 0 ||
    f.disciplines.length > 0 ||
    f.difficulty !== null ||
    f.minRating !== null
  );
}

const SORT_KEYS: ExploreSortKey[] = ["relevance", "avgGrade", "courseCode", "profRating"];
const SORT_DIRS: ExploreSortDir[] = ["asc", "desc"];
const SORT_DEFAULT_DIR: Record<ExploreSortKey, ExploreSortDir> = {
  relevance: "desc",
  avgGrade: "desc",
  courseCode: "asc",
  profRating: "desc",
};

const LEVEL_VALUES: ExploreFilterLevel[] = [1000, 2000, 3000, 4000, 5000];
const LANGUAGE_VALUES: Array<"en" | "fr"> = ["en", "fr"];
const DIFFICULTY_VALUES: ExploreFilterDifficulty[] = ["easy", "moderate", "tough"];
const MIN_RATING_VALUES = [3, 3.5, 4];

function parseCsv(input: unknown): string[] {
  if (typeof input !== "string") return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseDisciplineCsv(input: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of parseCsv(input)) {
    const code = value.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function parseSortKey(input: unknown): ExploreSortKey {
  if (typeof input !== "string") return "relevance";
  return SORT_KEYS.includes(input as ExploreSortKey) ? (input as ExploreSortKey) : "relevance";
}

function parseSortDir(input: unknown, sortKey: ExploreSortKey): ExploreSortDir {
  if (typeof input === "string" && SORT_DIRS.includes(input as ExploreSortDir)) {
    return input as ExploreSortDir;
  }
  return SORT_DEFAULT_DIR[sortKey];
}

export function parseExploreFiltersSearch(search: Record<string, unknown>): ExploreFilterState {
  const levels = parseCsv(search.levels)
    .map((value) => Number(value))
    .filter((value): value is ExploreFilterLevel =>
      LEVEL_VALUES.includes(value as ExploreFilterLevel),
    );

  const languages = parseCsv(search.langs).filter((value): value is "en" | "fr" =>
    LANGUAGE_VALUES.includes(value as "en" | "fr"),
  );

  const disciplines = parseDisciplineCsv(search.disc);

  const difficulty = DIFFICULTY_VALUES.includes(search.difficulty as ExploreFilterDifficulty)
    ? (search.difficulty as ExploreFilterDifficulty)
    : null;

  const minRatingRaw = typeof search.minRating === "string" ? Number(search.minRating) : null;
  const minRating =
    minRatingRaw != null && MIN_RATING_VALUES.includes(minRatingRaw) ? minRatingRaw : null;

  const sortKey = parseSortKey(search.sort);
  const sortDir = parseSortDir(search.dir, sortKey);

  return {
    levels,
    languages,
    disciplines,
    difficulty,
    minRating,
    sortKey,
    sortDir,
  };
}

export function serializeExploreFiltersSearch(filters: ExploreFilterState): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.levels.length > 0) params.levels = filters.levels.join(",");
  if (filters.languages.length > 0) params.langs = filters.languages.join(",");
  if (filters.disciplines.length > 0) params.disc = filters.disciplines.join(",");
  if (filters.difficulty !== null) params.difficulty = filters.difficulty;
  if (filters.minRating !== null) params.minRating = String(filters.minRating);

  if (filters.sortKey !== "relevance") {
    params.sort = filters.sortKey;
    params.dir = filters.sortDir;
  }

  return params;
}

export function getCourseDiscipline(code: string): string | null {
  const match = code.match(/^([A-Za-z]{3,4})/);
  if (!match) return null;
  return match[1].toUpperCase();
}

export function getCourseLevel(code: string): ExploreFilterLevel | null {
  const match = code.match(/(\d{4,5})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  if (n >= 5000) return 5000;
  const bucket = Math.floor(n / 1000) * 1000;
  if (bucket >= 1000 && bucket <= 4000) return bucket as ExploreFilterLevel;
  return null;
}

function gradeVizGpa(gradeViz: ExploreCourseSearchEntry["gradeViz"]): number | null {
  if (!gradeViz) return null;
  const dist: Record<string, number> = {};
  for (const entry of gradeViz.histogram) {
    dist[entry.grade] = (dist[entry.grade] ?? 0) + entry.count;
  }
  return distributionGpa(dist);
}

function compareNullableNumber(a: number | null, b: number | null, dir: ExploreSortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return dir === "asc" ? -1 : 1;
  if (b == null) return dir === "asc" ? 1 : -1;
  return dir === "asc" ? a - b : b - a;
}

export function compareCourseEntries(
  a: ExploreCourseSearchEntry,
  b: ExploreCourseSearchEntry,
  sortKey: ExploreSortKey,
  sortDir: ExploreSortDir,
): number {
  if (sortKey === "avgGrade") {
    return compareNullableNumber(gradeVizGpa(a.gradeViz), gradeVizGpa(b.gradeViz), sortDir);
  }
  if (sortKey === "courseCode") {
    const cmp = a.courseCode.localeCompare(b.courseCode, "en");
    return sortDir === "asc" ? cmp : -cmp;
  }
  return 0;
}

export function compareProfessorEntries(
  a: ExploreProfessorSearchEntry,
  b: ExploreProfessorSearchEntry,
  sortKey: ExploreSortKey,
  sortDir: ExploreSortDir,
): number {
  if (sortKey !== "profRating") return 0;
  return compareNullableNumber(a.maxRating, b.maxRating, sortDir);
}

function getDifficultyBucket(gpa: number): ExploreFilterDifficulty {
  if (gpa >= 9) return "easy";
  if (gpa >= 7.5) return "moderate";
  return "tough";
}

export function filterCourseEntries(
  entries: ExploreCourseSearchEntry[],
  filters: ExploreFilterState,
): ExploreCourseSearchEntry[] {
  return entries.filter((e) => {
    if (filters.levels.length > 0) {
      if (e.level === null || !filters.levels.includes(e.level)) return false;
    }
    if (filters.languages.length > 0) {
      if (e.language === null || !filters.languages.includes(e.language)) return false;
    }
    if (filters.disciplines.length > 0) {
      const discipline = getCourseDiscipline(e.courseCode);
      if (discipline === null || !filters.disciplines.includes(discipline)) return false;
    }
    if (filters.difficulty !== null) {
      const gpa = gradeVizGpa(e.gradeViz);
      if (gpa == null) return false;
      if (getDifficultyBucket(gpa) !== filters.difficulty) return false;
    }
    if (filters.minRating !== null) {
      if (e.maxProfessorRating === null || e.maxProfessorRating < filters.minRating) return false;
    }
    return true;
  });
}

export function filterProfessorEntries(
  entries: ExploreProfessorSearchEntry[],
  filters: ExploreFilterState,
): ExploreProfessorSearchEntry[] {
  const byDiscipline = filters.disciplines.length > 0;
  const byRating = filters.minRating !== null;
  if (!byDiscipline && !byRating) return entries;
  return entries.filter((e) => {
    if (byRating && (e.maxRating === null || e.maxRating < filters.minRating!)) return false;
    if (byDiscipline && !e.disciplines.some((d) => filters.disciplines.includes(d))) return false;
    return true;
  });
}
