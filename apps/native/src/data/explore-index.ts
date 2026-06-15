import type {
  Catalogue,
  CourseGradesData,
  Discipline,
  Faculty,
  SchedulesData,
  Term,
} from "@uoplan/core/dataTypes";
import {
  distributionGpa,
  GRADE_POINTS,
  type GradeVizData,
  normalizeGradeVizDistribution,
} from "@uoplan/core/gradeDistribution";
import { normalizeProfessorName, type ProfessorRatingsMap } from "@uoplan/core/professorRatings";
import type { ProfessorRegistryEntry } from "@uoplan/core/professorRegistry";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

/** Grades excluded from the GPA denominator (mirrors web `gradedHeadcount`). */
const SKIP_GRADES = new Set(["P", "S", "NS", "NC", "ABS", "EIN"]);
const FAIL_GRADES = new Set(["F", "E", "ABS"]);

/** Minimum graded headcount for a course/prof to appear in a spotlight carousel. */
export const SPOTLIGHT_MIN_GRADED = 40;

type Distribution = Record<string, number>;

/** The decoded data the explore index is built from (produced by the provider). */
export interface AppDataBundle {
  terms: Term[];
  disciplines: Discipline[];
  faculties: Faculty[];
  grades: CourseGradesData;
  catalogue: Catalogue;
  professors: ProfessorRegistryEntry[];
  ratings: ProfessorRatingsMap;
}

export interface ExploreCourseEntry {
  code: string;
  title: string;
  discipline: string;
  distribution: Distribution;
  gradeViz: GradeVizData | null;
  gpa: number | null;
  graded: number;
  failRate: number;
  termIds: string[];
}

export interface ExploreDisciplineEntry {
  code: string;
  name: string;
  facultyId?: string;
  courseCount: number;
  graded: number;
  gradeViz: GradeVizData | null;
}

export interface ExploreFacultyEntry {
  id: string;
  name: string;
  disciplineCount: number;
  graded: number;
  gradeViz: GradeVizData | null;
}

export interface ExploreProgramEntry {
  title: string;
  slug?: string;
  url: string;
}

export interface ExploreProfessorEntry {
  slug: string;
  name: string;
  rating?: number;
  numRatings?: number;
  graded: number;
  gpa: number | null;
  gradeViz: GradeVizData | null;
  termIds: string[];
  disciplines: string[];
}

export interface ExploreIndex {
  courses: ExploreCourseEntry[];
  disciplines: ExploreDisciplineEntry[];
  faculties: ExploreFacultyEntry[];
  programs: ExploreProgramEntry[];
  professors: ExploreProfessorEntry[];
}

export interface ExploreSearchResults {
  courses: ExploreCourseEntry[];
  professors: ExploreProfessorEntry[];
  disciplines: ExploreDisciplineEntry[];
  faculties: ExploreFacultyEntry[];
  programs: ExploreProgramEntry[];
}

export const EXPLORE_COURSE_LEVELS = [1000, 2000, 3000, 4000, 5000] as const;

export type ExploreCourseLevel = (typeof EXPLORE_COURSE_LEVELS)[number];
export type ExploreCourseLanguage = "en" | "fr";
export type ExploreFilterDifficulty = "easy" | "moderate" | "tough";
export type ExploreSortKey = "relevance" | "grade" | "code" | "rating" | "feedback";
export type ExploreSortDir = "asc" | "desc";

export const DIFFICULTY_VALUES = ["easy", "moderate", "tough"] as const;
export const MIN_RATING_VALUES = [3, 3.5, 4] as const;
export const MIN_FEEDBACK_VALUES = [3, 3.5, 4] as const;
export const SORT_KEYS = ["relevance", "grade", "code", "rating", "feedback"] as const;
export const SORT_DEFAULT_DIR: Record<ExploreSortKey, ExploreSortDir> = {
  relevance: "desc",
  grade: "desc",
  code: "asc",
  rating: "desc",
  feedback: "desc",
};

export interface ExploreSearchFilters {
  levels?: readonly ExploreCourseLevel[];
  languages?: readonly ExploreCourseLanguage[];
  disciplines?: readonly string[];
  difficulty?: ExploreFilterDifficulty | null;
  minRating?: number | null;
  minFeedback?: number | null;
  termId?: string | number | null;
  contributesToRequirements?: boolean;
  sortKey?: ExploreSortKey;
  sortDir?: ExploreSortDir;
  courseSentimentByNorm?: ReadonlyMap<string, number> | null;
  professorSentimentByName?: ReadonlyMap<string, number> | null;
  requirementCandidateSet?: ReadonlySet<string> | null;
}

/** Students that count toward the GPA (mirrors web `gradedHeadcount`). */
export function gradedHeadcount(dist: Distribution): number {
  let mass = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (SKIP_GRADES.has(letter) || GRADE_POINTS[letter] === undefined) continue;
    if (count > 0) mass += count;
  }
  return mass;
}

/** F + E + ABS headcount (mirrors web `failHeadcount`). */
export function failHeadcount(dist: Distribution): number {
  let fail = 0;
  for (const [letter, count] of Object.entries(dist)) {
    if (FAIL_GRADES.has(letter) && count > 0) fail += count;
  }
  return fail;
}

function mergeInto(target: Distribution, source: Distribution): void {
  for (const [letter, count] of Object.entries(source)) {
    if (!count) continue;
    target[letter] = (target[letter] ?? 0) + count;
  }
}

function disciplinePrefix(code: string): string {
  return code.split(/\s+/)[0]?.toUpperCase() ?? code.toUpperCase();
}

/**
 * Build the searchable explore index from the decoded data bundle. Mirrors the
 * web `gradesSearch.ts` / `courseSpotlight.ts` aggregation: per-course grade
 * totals (merged across every offering), per-discipline + per-faculty rollups by
 * course-code prefix, the catalogue's programs, and per-professor grade totals
 * (merged across the courses they taught).
 *
 * `schedulesByTerm` (optional) supplies which *registration* terms each course
 * and professor is offered in — the term filter in explore uses terms.pb
 * registration terms, so it must match offerings (including upcoming terms that
 * have no grades yet), not the historical grade terms.
 */
export function buildExploreIndex(
  bundle: AppDataBundle,
  schedulesByTerm?: ReadonlyMap<string, SchedulesData>,
): ExploreIndex {
  const distByCourse = new Map<string, Distribution>();
  const distByProfRef = new Map<number, Distribution>();
  const disciplinesByProfRef = new Map<number, Set<string>>();
  const { offeredTermsByCourse, offeredTermsByProfRef } = buildOfferedTerms(schedulesByTerm);

  for (const course of bundle.grades.courses) {
    const code = course.code;
    let courseDist = distByCourse.get(code);
    if (!courseDist) {
      courseDist = {};
      distByCourse.set(code, courseDist);
    }
    const courseDiscipline = disciplinePrefix(code);
    for (const prof of course.sections) {
      mergeInto(courseDist, prof.distribution);
      if (prof.professorRef && prof.professorRef > 0) {
        let profDist = distByProfRef.get(prof.professorRef);
        if (!profDist) {
          profDist = {};
          distByProfRef.set(prof.professorRef, profDist);
        }
        mergeInto(profDist, prof.distribution);
        const disciplines = disciplinesByProfRef.get(prof.professorRef) ?? new Set<string>();
        disciplines.add(courseDiscipline);
        disciplinesByProfRef.set(prof.professorRef, disciplines);
      }
    }
  }

  const titleByCode = new Map<string, string>();
  for (const c of bundle.catalogue.courses) titleByCode.set(c.code, c.title);

  const courseCodes = new Set<string>([...titleByCode.keys(), ...distByCourse.keys()]);
  const courses: ExploreCourseEntry[] = [];
  for (const code of courseCodes) {
    const distribution = distByCourse.get(code) ?? {};
    const graded = gradedHeadcount(distribution);
    courses.push({
      code,
      title: titleByCode.get(code) ?? code,
      discipline: disciplinePrefix(code),
      distribution,
      gradeViz: normalizeGradeVizDistribution(distribution),
      gpa: distributionGpa(distribution),
      graded,
      failRate: graded > 0 ? failHeadcount(distribution) / graded : 0,
      termIds: [...(offeredTermsByCourse.get(normalizeCourseCode(code)) ?? [])].sort(),
    });
  }
  courses.sort((a, b) => a.code.localeCompare(b.code));

  const distByPrefix = new Map<string, Distribution>();
  const courseCountByPrefix = new Map<string, number>();
  for (const course of courses) {
    const prefix = course.discipline;
    let dist = distByPrefix.get(prefix);
    if (!dist) {
      dist = {};
      distByPrefix.set(prefix, dist);
    }
    mergeInto(dist, course.distribution);
    courseCountByPrefix.set(prefix, (courseCountByPrefix.get(prefix) ?? 0) + 1);
  }

  const disciplines: ExploreDisciplineEntry[] = bundle.disciplines.map((d) => {
    const dist = distByPrefix.get(d.code.toUpperCase()) ?? {};
    return {
      code: d.code,
      name: d.name,
      facultyId: d.facultyId,
      courseCount: courseCountByPrefix.get(d.code.toUpperCase()) ?? 0,
      graded: gradedHeadcount(dist),
      gradeViz: normalizeGradeVizDistribution(dist),
    };
  });
  disciplines.sort((a, b) => a.name.localeCompare(b.name));

  const disciplinesByFaculty = new Map<string, Discipline[]>();
  for (const d of bundle.disciplines) {
    if (!d.facultyId) continue;
    const list = disciplinesByFaculty.get(d.facultyId) ?? [];
    list.push(d);
    disciplinesByFaculty.set(d.facultyId, list);
  }
  const faculties: ExploreFacultyEntry[] = bundle.faculties.map((f) => {
    const facultyDisciplines = disciplinesByFaculty.get(f.id) ?? [];
    const dist: Distribution = {};
    for (const d of facultyDisciplines) {
      const prefixDist = distByPrefix.get(d.code.toUpperCase());
      if (prefixDist) mergeInto(dist, prefixDist);
    }
    return {
      id: f.id,
      name: f.name,
      disciplineCount: facultyDisciplines.length,
      graded: gradedHeadcount(dist),
      gradeViz: normalizeGradeVizDistribution(dist),
    };
  });
  faculties.sort((a, b) => a.name.localeCompare(b.name));

  const programs: ExploreProgramEntry[] = bundle.catalogue.programs
    .map((p) => ({ title: p.title, slug: p.slug, url: p.url }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const professors: ExploreProfessorEntry[] = bundle.professors.map((entry, i) => {
    const dist = distByProfRef.get(i + 1) ?? {};
    const graded = gradedHeadcount(dist);
    const ratingFromMap = bundle.ratings[normalizeName(entry.name)]?.rating;
    return {
      slug: entry.slug,
      name: entry.name,
      rating: entry.rating ?? ratingFromMap,
      numRatings: entry.numRatings,
      graded,
      gpa: distributionGpa(dist),
      gradeViz: normalizeGradeVizDistribution(dist),
      termIds: [...(offeredTermsByProfRef.get(i + 1) ?? [])].sort(),
      disciplines: [...(disciplinesByProfRef.get(i + 1) ?? [])].sort(),
    };
  });
  professors.sort((a, b) => a.name.localeCompare(b.name));

  return { courses, disciplines, faculties, programs, professors };
}

/**
 * Map each course (by normalized code) and professor (by ref) to the set of
 * registration term ids it is *offered* in, from the schedules data. Professor
 * refs come from the section meeting times and predicted instructors.
 */
function buildOfferedTerms(schedulesByTerm?: ReadonlyMap<string, SchedulesData>): {
  offeredTermsByCourse: Map<string, Set<string>>;
  offeredTermsByProfRef: Map<number, Set<string>>;
} {
  const offeredTermsByCourse = new Map<string, Set<string>>();
  const offeredTermsByProfRef = new Map<number, Set<string>>();
  if (!schedulesByTerm) return { offeredTermsByCourse, offeredTermsByProfRef };

  const addProfTerm = (ref: number | undefined, termId: string): void => {
    if (!ref || ref <= 0) return;
    const set = offeredTermsByProfRef.get(ref) ?? new Set<string>();
    set.add(termId);
    offeredTermsByProfRef.set(ref, set);
  };

  for (const [termKey, schedules] of schedulesByTerm) {
    const termId = String(schedules.termId || termKey);
    for (const entry of schedules.schedules) {
      const code = normalizeCourseCode(entry.courseCode);
      const set = offeredTermsByCourse.get(code) ?? new Set<string>();
      set.add(termId);
      offeredTermsByCourse.set(code, set);
      for (const sections of Object.values(entry.components)) {
        for (const section of sections) {
          for (const time of section.times) addProfTerm(time.professorRef, termId);
          for (const predicted of section.predictedInstructors ?? []) {
            addProfTerm(predicted.professorRef, termId);
          }
        }
      }
    }
  }

  return { offeredTermsByCourse, offeredTermsByProfRef };
}

/** Lowercase, collapse whitespace — matches the web professor-name match key well enough. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function score(haystack: string, needle: string): number {
  const h = haystack.toLowerCase();
  const idx = h.indexOf(needle);
  if (idx < 0) return -1;
  if (h === needle) return 0;
  if (idx === 0) return 1;
  return 2 + idx;
}

const DEFAULT_LIMIT = 12;

export function exploreCourseLevel(code: string): ExploreCourseLevel | null {
  const match = code.match(/(\d{4,5})/);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 5000) return 5000;
  const bucket = Math.floor(numeric / 1000) * 1000;
  return EXPLORE_COURSE_LEVELS.includes(bucket as ExploreCourseLevel)
    ? (bucket as ExploreCourseLevel)
    : null;
}

export function exploreCourseLanguage(code: string): ExploreCourseLanguage | null {
  const match = code.match(/(\d{4,5})/);
  if (!match) return null;
  const secondDigit = Number(match[1][1]);
  if (!Number.isFinite(secondDigit)) return null;
  if (secondDigit >= 1 && secondDigit <= 4) return "en";
  if (secondDigit >= 5 && secondDigit <= 8) return "fr";
  return null;
}

export function getDifficultyBucket(gpa: number): ExploreFilterDifficulty {
  if (gpa >= 9) return "easy";
  if (gpa >= 7.5) return "moderate";
  return "tough";
}

function normalizedTermId(filters?: ExploreSearchFilters): string | null {
  return filters?.termId == null ? null : String(filters.termId);
}

function compareNullableNumber(a: number | null, b: number | null, dir: ExploreSortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return dir === "asc" ? -1 : 1;
  if (b == null) return dir === "asc" ? 1 : -1;
  return dir === "asc" ? a - b : b - a;
}

function sortDirFor(filters?: ExploreSearchFilters): ExploreSortDir {
  const key = filters?.sortKey ?? "relevance";
  return filters?.sortDir ?? SORT_DEFAULT_DIR[key];
}

function hasCourseFilters(filters?: ExploreSearchFilters): boolean {
  return (
    (filters?.levels?.length ?? 0) > 0 ||
    (filters?.languages?.length ?? 0) > 0 ||
    (filters?.disciplines?.length ?? 0) > 0 ||
    filters?.difficulty != null ||
    filters?.minFeedback != null ||
    filters?.termId != null ||
    Boolean(filters?.contributesToRequirements)
  );
}

function hasProfessorFilters(filters?: ExploreSearchFilters): boolean {
  return (
    (filters?.disciplines?.length ?? 0) > 0 ||
    filters?.minRating != null ||
    filters?.minFeedback != null ||
    filters?.termId != null
  );
}

function filterCourses(
  courses: readonly ExploreCourseEntry[],
  filters?: ExploreSearchFilters,
): ExploreCourseEntry[] {
  if (!hasCourseFilters(filters)) return [...courses];
  const disciplines = new Set((filters?.disciplines ?? []).map((code) => code.toUpperCase()));
  const termId = normalizedTermId(filters);
  const byFeedback = filters?.minFeedback != null && filters.courseSentimentByNorm != null;
  const byRequirements =
    Boolean(filters?.contributesToRequirements) && filters?.requirementCandidateSet != null;
  return courses.filter((course) => {
    if (filters?.levels?.length) {
      const level = exploreCourseLevel(course.code);
      if (level === null || !filters.levels.includes(level)) return false;
    }
    if (filters?.languages?.length) {
      const language = exploreCourseLanguage(course.code);
      if (language === null || !filters.languages.includes(language)) return false;
    }
    if (disciplines.size > 0 && !disciplines.has(course.discipline.toUpperCase())) {
      return false;
    }
    if (filters?.difficulty != null) {
      if (course.gpa == null || getDifficultyBucket(course.gpa) !== filters.difficulty) {
        return false;
      }
    }
    if (byFeedback) {
      const sentiment = filters.courseSentimentByNorm?.get(normalizeCourseCode(course.code));
      if (sentiment == null || sentiment < filters.minFeedback!) return false;
    }
    if (termId != null && !course.termIds.includes(termId)) return false;
    if (byRequirements && !filters.requirementCandidateSet!.has(normalizeCourseCode(course.code))) {
      return false;
    }
    return true;
  });
}

function filterProfessors(
  professors: readonly ExploreProfessorEntry[],
  filters?: ExploreSearchFilters,
): ExploreProfessorEntry[] {
  if (!hasProfessorFilters(filters)) return [...professors];
  const disciplines = new Set((filters?.disciplines ?? []).map((code) => code.toUpperCase()));
  const termId = normalizedTermId(filters);
  const byFeedback = filters?.minFeedback != null && filters.professorSentimentByName != null;
  return professors.filter((professor) => {
    if (
      filters?.minRating != null &&
      (professor.rating == null || professor.rating < filters.minRating)
    ) {
      return false;
    }
    if (byFeedback) {
      const sentiment = filters.professorSentimentByName?.get(
        normalizeProfessorName(professor.name),
      );
      if (sentiment == null || sentiment < filters.minFeedback!) return false;
    }
    if (termId != null && !professor.termIds.includes(termId)) return false;
    if (
      disciplines.size > 0 &&
      !professor.disciplines.some((discipline) => disciplines.has(discipline.toUpperCase()))
    ) {
      return false;
    }
    return true;
  });
}

function sortCourses(
  courses: ExploreCourseEntry[],
  filters?: ExploreSearchFilters,
): ExploreCourseEntry[] {
  const sortKey = filters?.sortKey ?? "relevance";
  if (sortKey !== "grade" && sortKey !== "code" && sortKey !== "feedback") return courses;
  const sortDir = sortDirFor(filters);
  return courses.slice().sort((a, b) => {
    if (sortKey === "grade") return compareNullableNumber(a.gpa, b.gpa, sortDir);
    if (sortKey === "code") {
      const cmp = a.code.localeCompare(b.code, "en");
      return sortDir === "asc" ? cmp : -cmp;
    }
    const fa = filters?.courseSentimentByNorm?.get(normalizeCourseCode(a.code)) ?? null;
    const fb = filters?.courseSentimentByNorm?.get(normalizeCourseCode(b.code)) ?? null;
    return compareNullableNumber(fa, fb, sortDir);
  });
}

function sortProfessors(
  professors: ExploreProfessorEntry[],
  filters?: ExploreSearchFilters,
): ExploreProfessorEntry[] {
  const sortKey = filters?.sortKey ?? "relevance";
  if (sortKey !== "rating" && sortKey !== "feedback") return professors;
  const sortDir = sortDirFor(filters);
  return professors.slice().sort((a, b) => {
    if (sortKey === "rating") {
      return compareNullableNumber(a.rating ?? null, b.rating ?? null, sortDir);
    }
    const fa = filters?.professorSentimentByName?.get(normalizeProfessorName(a.name)) ?? null;
    const fb = filters?.professorSentimentByName?.get(normalizeProfessorName(b.name)) ?? null;
    return compareNullableNumber(fa, fb, sortDir);
  });
}

/**
 * Search every explore result type (courses, professors, disciplines, faculties,
 * programs) for a free-text query, mirroring the web explore search sections.
 */
export function searchExplore(index: ExploreIndex, query: string): ExploreSearchResults;
export function searchExplore(
  index: ExploreIndex,
  query: string,
  limit: number,
): ExploreSearchResults;
export function searchExplore(
  index: ExploreIndex,
  query: string,
  filters: ExploreSearchFilters,
): ExploreSearchResults;
export function searchExplore(
  index: ExploreIndex,
  query: string,
  limit: number,
  filters: ExploreSearchFilters,
): ExploreSearchResults;
export function searchExplore(
  index: ExploreIndex,
  query: string,
  limitOrFilters: number | ExploreSearchFilters = DEFAULT_LIMIT,
  maybeFilters?: ExploreSearchFilters,
): ExploreSearchResults {
  const limit = typeof limitOrFilters === "number" ? limitOrFilters : DEFAULT_LIMIT;
  const filters = typeof limitOrFilters === "number" ? maybeFilters : limitOrFilters;
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const courses = filterCourses(index.courses, filters);
  const professors = filterProfessors(index.professors, filters);
  if (!q) {
    return {
      courses: hasCourseFilters(filters) ? sortCourses(courses, filters).slice(0, limit) : [],
      professors: hasProfessorFilters(filters)
        ? sortProfessors(professors, filters).slice(0, limit)
        : [],
      disciplines: [],
      faculties: [],
      programs: [],
    };
  }

  const rank = <T>(items: T[], key: (item: T) => string[]): T[] =>
    items
      .map((item) => {
        const best = key(item).reduce((acc, field) => {
          const s = score(field, q);
          return s >= 0 && (acc < 0 || s < acc) ? s : acc;
        }, -1);
        return { item, s: best };
      })
      .filter((r) => r.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, limit)
      .map((r) => r.item);

  return {
    courses: sortCourses(
      rank(courses, (c) => [c.code, c.title]),
      filters,
    ),
    professors: sortProfessors(
      rank(professors, (p) => [p.name]),
      filters,
    ),
    disciplines: rank(index.disciplines, (d) => [d.code, d.name]),
    faculties: rank(index.faculties, (f) => [f.name]),
    programs: rank(index.programs, (p) => [p.title]),
  };
}

export interface CourseSpotlight {
  id: "gpa" | "fail" | "graded";
  title: string;
  courses: ExploreCourseEntry[];
}

/** Empty-query browse carousels: hardest, highest-fail, most-graded courses. */
export function courseSpotlights(index: ExploreIndex, size = 10): CourseSpotlight[] {
  const eligible = index.courses.filter((c) => c.graded >= SPOTLIGHT_MIN_GRADED);
  return [
    {
      id: "gpa",
      title: "Hardest courses",
      courses: [...eligible]
        .filter((c) => c.gpa != null)
        .sort((a, b) => (a.gpa ?? 0) - (b.gpa ?? 0))
        .slice(0, size),
    },
    {
      id: "fail",
      title: "Highest fail rate",
      courses: [...eligible].sort((a, b) => b.failRate - a.failRate).slice(0, size),
    },
    {
      id: "graded",
      title: "Most graded",
      courses: [...eligible].sort((a, b) => b.graded - a.graded).slice(0, size),
    },
  ];
}
