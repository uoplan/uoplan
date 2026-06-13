import type { ProgramRequirement } from "../dataTypes";
import type { DataCache } from "../dataCache";
import { getDiscipline } from "../utils/courseUtils";
import { facultyIdFromName } from "../facultyIdentity";
function extractCourseCodes(req: ProgramRequirement): string[] {
  const codes: string[] = [];
  if (req.code) codes.push(req.code);
  if (req.options) {
    for (const opt of req.options) {
      codes.push(...extractCourseCodes(opt));
    }
  }
  return codes;
}

function applyExcludedDisciplines(codes: string[], excluded: string[] | undefined): string[] {
  if (!excluded?.length) return codes;
  const excludedSet = new Set(excluded.map((d) => d.toUpperCase()));
  return codes.filter((code) => !excludedSet.has(getDiscipline(code)));
}

function matchesLevels(code: string, levels: number[]): boolean {
  const match = code.match(/\d{4,5}/);
  if (!match) return false;
  const num = parseInt(match[0].replaceAll(/\D/g, "").slice(0, 4), 10);
  return levels.some((l) => num >= l && num < l + 1000);
}

/**
 * Courses belonging to a requirement's faculty, or null when the faculty can't be
 * resolved (no faculty string, no disciplines data loaded, or an unknown name) so
 * the caller can fall back to the broad elective pool.
 */
function facultyCandidateCodes(cache: DataCache, faculty: string | undefined) {
  if (!faculty) return null;
  const facultyId = facultyIdFromName(faculty);
  if (!facultyId) return null;
  const courses = cache.getCoursesByFaculty(facultyId);
  return courses.length > 0 ? courses : null;
}

export function resolveDisciplineElective(
  cache: DataCache,
  discipline: string,
  levels?: number[],
): string[] {
  const courses = cache.getCoursesByDiscipline(discipline);
  if (!levels || levels.length === 0) {
    return courses.map((c) => c.code);
  }
  return courses.filter((c) => matchesLevels(c.code, levels)).map((c) => c.code);
}

export function resolveElectiveCandidates(
  cache: DataCache,
  req: ProgramRequirement,
  credits?: number,
): string[] {
  switch (req.type) {
    case "discipline_elective": {
      const disciplines = req.disciplineLevels ?? [];
      const all: string[] = [];
      for (const dl of disciplines) {
        all.push(...resolveDisciplineElective(cache, dl.discipline, dl.levels));
      }
      return applyExcludedDisciplines([...new Set(all)], req.excluded_disciplines);
    }
    case "faculty_elective":
    case "free_elective":
    case "non_discipline_elective":
    case "elective": {
      const explicit = extractCourseCodes(req);
      if (explicit.length > 0) return applyExcludedDisciplines(explicit, req.excluded_disciplines);
      const creditsNeeded = credits ?? req.credits ?? 3;
      // A faculty_elective with a resolvable faculty is restricted to the courses
      // whose discipline belongs to that faculty. When the faculty can't be
      // resolved (no disciplines data / unknown name) we fall back to the broad
      // pool below, preserving the previous behaviour.
      const facultyCourses =
        req.type === "faculty_elective" ? facultyCandidateCodes(cache, req.faculty) : null;
      const allCourses = facultyCourses ?? cache.getAllCourses();
      let candidates = allCourses.filter((c) => c.credits <= creditsNeeded).map((c) => c.code);
      if (req.levels && req.levels.length > 0) {
        candidates = candidates.filter((code) => matchesLevels(code, req.levels!));
      }
      return applyExcludedDisciplines(candidates, req.excluded_disciplines);
    }
    default:
      return [];
  }
}
