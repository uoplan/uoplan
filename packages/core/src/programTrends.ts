import type { CourseGradesData, Program, ProgramRequirement } from "./dataTypes";
import type { NormalizedCourseCode } from "./brand";
import { countedMass } from "./gradeDistribution";
import { disciplineOf, levelOf, normalizeCourseCode } from "./utils/courseUtils";
import { urlToSlug } from "./stateEncode";

/**
 * Approximate, per-program scoping for {@link computeGradeTrends}. uOttawa does
 * not publish grades broken down by program, so we estimate the courses a degree
 * "touches" from its requirements tree: concrete required courses plus
 * discipline-scoped elective pools (e.g. "any CSI at the 3000 level"). Broad
 * electives (free / faculty / non-discipline / generic) are intentionally
 * ignored — they are open to anyone and reveal nothing about the program.
 *
 * Everything here is pure and unit-tested; the web layer handles selection,
 * memoisation, and localisation.
 */

/** Discipline + (optional) level buckets pool, e.g. `{ discipline: "CSI", levels: [3000] }`. */
export interface ProgramDisciplinePool {
  discipline: string;
  /** Level buckets (1000, 2000, …). Empty/undefined means any level. */
  levels?: number[];
}

/** A matcher over course codes describing a program's estimated core course set. */
export interface ProgramCourseFilter {
  /** Concrete required course codes (normalised, e.g. `CSI 2110`). */
  codes: Set<NormalizedCourseCode>;
  /** Discipline-scoped elective pools. */
  pools: ProgramDisciplinePool[];
}

/** Requirement node types that are broad electives and reveal no program signal. */
const BROAD_ELECTIVE_TYPES: ReadonlySet<string> = new Set([
  "elective",
  "free_elective",
  "non_discipline_elective",
  "faculty_elective",
]);

function collectInto(node: ProgramRequirement, filter: ProgramCourseFilter): void {
  if (BROAD_ELECTIVE_TYPES.has(node.type)) return;

  if ((node.type === "course" || node.type === "or_course") && node.code) {
    filter.codes.add(normalizeCourseCode(node.code));
  }

  if (node.type === "discipline_elective" && node.disciplineLevels?.length) {
    for (const dl of node.disciplineLevels) {
      if (!dl.discipline) continue;
      filter.pools.push({
        discipline: dl.discipline.toUpperCase(),
        levels: dl.levels && dl.levels.length > 0 ? [...dl.levels] : undefined,
      });
    }
  }

  if (node.options?.length) {
    for (const child of node.options) collectInto(child, filter);
  }
}

/**
 * Extract a program's estimated core course set from its requirements tree:
 * concrete required courses + discipline-scoped elective pools. Broad electives
 * are excluded.
 */
export function buildProgramCourseFilter(program: Program): ProgramCourseFilter {
  const filter: ProgramCourseFilter = { codes: new Set(), pools: [] };
  for (const req of program.requirements) collectInto(req, filter);
  return filter;
}

/** True when `code` is in the program's core set (an explicit code or a pool match). */
export function programFilterMatches(filter: ProgramCourseFilter, code: string): boolean {
  if (filter.codes.has(normalizeCourseCode(code))) return true;
  if (filter.pools.length === 0) return false;
  const discipline = disciplineOf(code);
  if (!discipline) return false;
  const level = levelOf(code);
  for (const pool of filter.pools) {
    if (pool.discipline !== discipline) continue;
    if (!pool.levels || pool.levels.length === 0) return true;
    if (level != null && pool.levels.includes(level)) return true;
  }
  return false;
}

/** Stable slug for a program (prefer the scraped `slug`, else derive from URL). */
export function programSlug(program: Program): string {
  return program.slug ?? urlToSlug(program.url);
}

export interface ProgramOption {
  slug: string;
  title: string;
}

/**
 * Programs whose estimated core courses intersect the grades dataset, so the
 * trends filter only offers degrees that can actually be charted. Results are
 * de-duplicated by slug and sorted by title.
 */
export function availablePrograms(grades: CourseGradesData, programs: Program[]): ProgramOption[] {
  const gradedCodes = new Set<NormalizedCourseCode>();
  const gradedDisciplines = new Set<string>();
  for (const course of grades.courses) {
    let mass = 0;
    for (const prof of course.professors) {
      if (!prof.distribution || typeof prof.distribution !== "object") continue;
      mass += countedMass(prof.distribution);
    }
    if (mass <= 0) continue;
    gradedCodes.add(course.code);
    const discipline = disciplineOf(course.code);
    if (discipline) gradedDisciplines.add(discipline);
  }

  const seen = new Set<string>();
  const out: ProgramOption[] = [];
  for (const program of programs) {
    const slug = programSlug(program);
    if (seen.has(slug)) continue;
    const filter = buildProgramCourseFilter(program);
    const hasCodeData = [...filter.codes].some((code) => gradedCodes.has(code));
    const hasPoolData =
      !hasCodeData && filter.pools.some((pool) => gradedDisciplines.has(pool.discipline));
    if (!hasCodeData && !hasPoolData) continue;
    seen.add(slug);
    out.push({ slug, title: program.title });
  }

  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}
