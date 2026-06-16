import { gradeVizGpa, normalizeCourseCode } from "@uoplan/core";
import type { RemainingRequirement } from "@uoplan/core";
import type { ExploreCourseSearchEntry, ExploreProfessorSearchEntry } from "./gradesSearch";

export type ExploreFilterLevel = 1000 | 2000 | 3000 | 4000 | 5000;
export type ExploreFilterDifficulty = "easy" | "moderate" | "tough";
export type ExploreSortKey = "relevance" | "grade" | "code" | "rating" | "feedback";
export type ExploreSortDir = "asc" | "desc";
export type ExploreSearchParams = {
  q: string | undefined;
  levels: string | undefined;
  langs: string | undefined;
  disc: string | undefined;
  difficulty: string | undefined;
  rating: number | undefined;
  feedback: number | undefined;
  term: number | undefined;
  reqs: string | undefined;
  sort: string | undefined;
  dir: string | undefined;
};

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

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
    rating: toFiniteNumber(search.rating),
    feedback: toFiniteNumber(search.feedback),
    term: toFiniteNumber(search.term),
    reqs: search.reqs === "1" ? "1" : undefined,
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
  rating: undefined,
  feedback: undefined,
  term: undefined,
  reqs: undefined,
  sort: undefined,
  dir: undefined,
};

export type ExploreFilterState = {
  levels: ExploreFilterLevel[];
  languages: ("en" | "fr")[];
  disciplines: string[];
  difficulty: ExploreFilterDifficulty | null;
  minRating: number | null;
  minFeedback: number | null;
  termId: number | null;
  contributesToRequirements: boolean;
  sortKey: ExploreSortKey;
  sortDir: ExploreSortDir;
};

export const EMPTY_FILTERS: ExploreFilterState = {
  levels: [],
  languages: [],
  disciplines: [],
  difficulty: null,
  minRating: null,
  minFeedback: null,
  termId: null,
  contributesToRequirements: false,
  sortKey: "relevance",
  sortDir: "desc",
};

export function hasActiveFilters(f: ExploreFilterState): boolean {
  return (
    f.levels.length > 0 ||
    f.languages.length > 0 ||
    f.disciplines.length > 0 ||
    f.difficulty !== null ||
    f.minRating !== null ||
    f.minFeedback !== null ||
    f.termId !== null ||
    f.contributesToRequirements
  );
}

const SORT_KEYS: ExploreSortKey[] = ["relevance", "grade", "code", "rating", "feedback"];
const SORT_DIRS: ExploreSortDir[] = ["asc", "desc"];
const SORT_DEFAULT_DIR: Record<ExploreSortKey, ExploreSortDir> = {
  relevance: "desc",
  grade: "desc",
  code: "asc",
  rating: "desc",
  feedback: "desc",
};

const LEVEL_VALUES: ExploreFilterLevel[] = [1000, 2000, 3000, 4000, 5000];
const LANGUAGE_VALUES: Array<"en" | "fr"> = ["en", "fr"];
const DIFFICULTY_VALUES: ExploreFilterDifficulty[] = ["easy", "moderate", "tough"];
const MIN_RATING_VALUES = [3, 3.5, 4];
const MIN_FEEDBACK_VALUES = [3, 3.5, 4];

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

  const minRatingRaw = search.rating != null ? Number(search.rating) : null;
  const minRating =
    minRatingRaw != null && MIN_RATING_VALUES.includes(minRatingRaw) ? minRatingRaw : null;

  const minFeedbackRaw = search.feedback != null ? Number(search.feedback) : null;
  const minFeedback =
    minFeedbackRaw != null && MIN_FEEDBACK_VALUES.includes(minFeedbackRaw) ? minFeedbackRaw : null;

  const termRaw = search.term != null ? Number(search.term) : null;
  const termId = termRaw != null && Number.isInteger(termRaw) && termRaw > 0 ? termRaw : null;

  const contributesToRequirements = search.reqs === "1";

  const sortKey = parseSortKey(search.sort);
  const sortDir = parseSortDir(search.dir, sortKey);

  return {
    levels,
    languages,
    disciplines,
    difficulty,
    minRating,
    minFeedback,
    termId,
    contributesToRequirements,
    sortKey,
    sortDir,
  };
}

export function serializeExploreFiltersSearch(
  filters: ExploreFilterState,
): Partial<ExploreSearchParams> {
  const params: Partial<ExploreSearchParams> = {};

  if (filters.levels.length > 0) params.levels = filters.levels.join(",");
  if (filters.languages.length > 0) params.langs = filters.languages.join(",");
  if (filters.disciplines.length > 0) params.disc = filters.disciplines.join(",");
  if (filters.difficulty !== null) params.difficulty = filters.difficulty;
  if (filters.minRating !== null) params.rating = filters.minRating;
  if (filters.minFeedback !== null) params.feedback = filters.minFeedback;
  if (filters.termId !== null) params.term = filters.termId;
  if (filters.contributesToRequirements) params.reqs = "1";

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
  feedbackByNorm?: Map<string, number> | null,
): number {
  if (sortKey === "grade") {
    return compareNullableNumber(gradeVizGpa(a.gradeViz), gradeVizGpa(b.gradeViz), sortDir);
  }
  if (sortKey === "code") {
    const cmp = a.courseCode.localeCompare(b.courseCode, "en");
    return sortDir === "asc" ? cmp : -cmp;
  }
  if (sortKey === "feedback") {
    const fa = feedbackByNorm?.get(a.normCode) ?? null;
    const fb = feedbackByNorm?.get(b.normCode) ?? null;
    return compareNullableNumber(fa, fb, sortDir);
  }
  return 0;
}

export function compareProfessorEntries(
  a: ExploreProfessorSearchEntry,
  b: ExploreProfessorSearchEntry,
  sortKey: ExploreSortKey,
  sortDir: ExploreSortDir,
  feedbackByGroupId?: Map<string, number> | null,
): number {
  if (sortKey === "rating") {
    return compareNullableNumber(a.maxRating, b.maxRating, sortDir);
  }
  if (sortKey === "feedback") {
    const fa = feedbackByGroupId?.get(a.groupId) ?? null;
    const fb = feedbackByGroupId?.get(b.groupId) ?? null;
    return compareNullableNumber(fa, fb, sortDir);
  }
  return 0;
}

function getDifficultyBucket(gpa: number): ExploreFilterDifficulty {
  if (gpa >= 9) return "easy";
  if (gpa >= 7.5) return "moderate";
  return "tough";
}

export type ExploreTermSets = {
  courseComponents: Set<string> | null;
  profGroups: Set<string> | null;
};

/**
 * Overall-sentiment (1-5) lookups derived from the course-feedback index. Course
 * sentiment is keyed by {@link ExploreCourseSearchEntry.normCode}; professor
 * sentiment by {@link ExploreProfessorSearchEntry.groupId}. A `null` map means the
 * feedback dataset has not loaded yet, so the feedback filter is skipped (rather
 * than transiently hiding every result).
 */
export type ExploreSentimentSets = {
  courseByNorm: Map<string, number> | null;
  professorByGroupId: Map<string, number> | null;
};

/**
 * Builds the set of normalized course codes that count toward the student's remaining
 * requirements, for the "fits my requirements" smart filter. Courses already on the
 * student's transcript are excluded: a partially-satisfied requirement still lists every
 * course in its pool (including ones already taken), and the filter exists to surface
 * courses the student could still take, not ones they have already completed.
 */
export function buildRequirementCandidateSet(
  remainingRequirements: RemainingRequirement[],
  completedCourses: readonly string[] = [],
): Set<string> {
  const completed = new Set(completedCourses.map((code) => normalizeCourseCode(code)));
  const set = new Set<string>();
  for (const req of remainingRequirements) {
    for (const candidate of req.candidateCourses ?? []) {
      const norm = normalizeCourseCode(candidate);
      if (completed.has(norm)) continue;
      set.add(norm);
    }
  }
  return set;
}

export function filterCourseEntries(
  entries: ExploreCourseSearchEntry[],
  filters: ExploreFilterState,
  termSets?: ExploreTermSets,
  sentiment?: ExploreSentimentSets,
  requirementCandidateSet?: Set<string> | null,
): ExploreCourseSearchEntry[] {
  const byTerm = filters.termId !== null;
  const byFeedback = filters.minFeedback !== null && sentiment?.courseByNorm != null;
  const byRequirements = filters.contributesToRequirements && requirementCandidateSet != null;
  return entries.filter((e) => {
    if (filters.levels.length > 0 && (e.level === null || !filters.levels.includes(e.level))) {
      return false;
    }
    if (
      filters.languages.length > 0 &&
      (e.language === null || !filters.languages.includes(e.language))
    ) {
      return false;
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
    if (
      filters.minRating !== null &&
      (e.maxProfessorRating === null || e.maxProfessorRating < filters.minRating)
    ) {
      return false;
    }
    if (byFeedback) {
      const s = sentiment!.courseByNorm!.get(e.normCode);
      if (s == null || s < filters.minFeedback!) return false;
    }
    if (byTerm && !termSets?.courseComponents?.has(e.componentId)) {
      return false;
    }
    if (byRequirements && !requirementCandidateSet!.has(e.normCode)) {
      return false;
    }
    return true;
  });
}

export function filterProfessorEntries(
  entries: ExploreProfessorSearchEntry[],
  filters: ExploreFilterState,
  termSets?: ExploreTermSets,
  sentiment?: ExploreSentimentSets,
): ExploreProfessorSearchEntry[] {
  const byDiscipline = filters.disciplines.length > 0;
  const byRating = filters.minRating !== null;
  const byFeedback = filters.minFeedback !== null && sentiment?.professorByGroupId != null;
  const byTerm = filters.termId !== null;
  if (!byDiscipline && !byRating && !byFeedback && !byTerm) return entries;
  return entries.filter((e) => {
    if (byRating && (e.maxRating === null || e.maxRating < filters.minRating!)) return false;
    if (byFeedback) {
      const s = sentiment!.professorByGroupId!.get(e.groupId);
      if (s == null || s < filters.minFeedback!) return false;
    }
    if (byDiscipline && !e.disciplines.some((d) => filters.disciplines.includes(d))) return false;
    if (byTerm && !termSets?.profGroups?.has(e.groupId)) return false;
    return true;
  });
}
