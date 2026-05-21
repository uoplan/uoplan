import type { ExploreCourseSearchEntry, ExploreProfessorSearchEntry } from "./gradesSearch";

export type ExploreFilterLevel = 1000 | 2000 | 3000 | 4000 | 5000;
export type ExploreFilterDifficulty = "easy" | "moderate" | "tough";

export type ExploreFilterState = {
  levels: ExploreFilterLevel[];
  languages: ("en" | "fr")[];
  difficulty: ExploreFilterDifficulty | null;
  minRating: number | null;
};

export const EMPTY_FILTERS: ExploreFilterState = {
  levels: [],
  languages: [],
  difficulty: null,
  minRating: null,
};

export function hasActiveFilters(f: ExploreFilterState): boolean {
  return (
    f.levels.length > 0 || f.languages.length > 0 || f.difficulty !== null || f.minRating !== null
  );
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

function getDifficultyBucket(passingPercent: number): ExploreFilterDifficulty {
  if (passingPercent > 0.75) return "easy";
  if (passingPercent >= 0.5) return "moderate";
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
    if (filters.difficulty !== null) {
      const pct = e.gradeViz?.passingPercent;
      if (pct == null) return false;
      if (getDifficultyBucket(pct) !== filters.difficulty) return false;
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
  if (filters.minRating === null) return entries;
  return entries.filter((e) => e.maxRating !== null && e.maxRating >= filters.minRating!);
}
