import type { Catalogue, Discipline, Faculty } from "@uoplan/core";

/** Pick the locale-appropriate faculty display name (French falls back to English). */
export function localizeFacultyName(faculty: Faculty, locale: string): string {
  if (locale.startsWith("fr") && faculty.nameFr) return faculty.nameFr;
  return faculty.name;
}

/**
 * Resolve the faculty that owns a discipline code, given the loaded disciplines
 * and faculty registry. Returns null when either dataset is absent or the
 * discipline has no faculty mapping.
 */
export function facultyForDisciplineCode(
  disciplines: Discipline[] | null,
  faculties: Faculty[] | null,
  code: string,
): Faculty | null {
  if (!disciplines || !faculties) return null;
  const normalized = code.toUpperCase().trim();
  const discipline = disciplines.find((d) => d.code.toUpperCase().trim() === normalized);
  if (!discipline?.facultyId) return null;
  return faculties.find((f) => f.id === discipline.facultyId) ?? null;
}

/**
 * Filter the faculty registry by a search query (matched against the id slug and
 * both localized names), capped at `limit`. Returns an empty array when the query
 * is blank or the registry is absent.
 */
export function filterFaculties(
  faculties: Faculty[] | null,
  query: string,
  limit: number,
): Faculty[] {
  const q = query.trim().toLowerCase();
  if (!q || !faculties) return [];
  return faculties
    .filter(
      (f) =>
        f.id.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        (f.nameFr?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, limit);
}

/**
 * Count catalogue courses per upper-cased discipline prefix (e.g. `ITI` → 42),
 * the input every faculty/discipline roll-up below is keyed on.
 */
export function buildDisciplineCourseCount(catalogue: Catalogue | null): Map<string, number> {
  const counts = new Map<string, number>();
  if (!catalogue) return counts;
  for (const course of catalogue.courses) {
    const prefix = course.code.split(/\s+/)[0]?.toUpperCase();
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

export type FacultyIndexRow = {
  faculty: Faculty;
  /** Upper-cased discipline prefixes the faculty owns that have catalogue courses. */
  prefixes: Set<string>;
  disciplineCount: number;
  courseCount: number;
};

/**
 * Summarize a single faculty: the discipline prefixes it owns (only those with at
 * least one catalogue course) plus the discipline and course totals. `courseCounts`
 * maps an upper-cased discipline prefix to its number of catalogue courses.
 */
export function facultyIndexRowFor(
  faculty: Faculty,
  disciplines: Discipline[] | null,
  courseCounts: Map<string, number>,
): FacultyIndexRow {
  const prefixes = new Set<string>();
  let disciplineCount = 0;
  let courseCount = 0;
  for (const discipline of disciplines ?? []) {
    if (discipline.facultyId !== faculty.id) continue;
    const prefix = discipline.code.toUpperCase();
    const count = courseCounts.get(prefix) ?? 0;
    if (count === 0) continue;
    prefixes.add(prefix);
    disciplineCount += 1;
    courseCount += count;
  }
  return { faculty, prefixes, disciplineCount, courseCount };
}

/**
 * Build the browsable faculty index: every faculty that owns at least one
 * discipline with catalogue courses, sorted by its localized display name.
 */
export function buildFacultyIndexRows(
  faculties: Faculty[] | null,
  disciplines: Discipline[] | null,
  courseCounts: Map<string, number>,
  locale: string,
): FacultyIndexRow[] {
  if (!faculties) return [];
  return faculties
    .map((faculty) => facultyIndexRowFor(faculty, disciplines, courseCounts))
    .filter((row) => row.disciplineCount > 0)
    .sort((a, b) =>
      localizeFacultyName(a.faculty, locale).localeCompare(
        localizeFacultyName(b.faculty, locale),
        locale,
      ),
    );
}

export type FacultyDisciplineEntry = { discipline: Discipline; courseCount: number };

/**
 * Group a faculty's disciplines (those with at least one catalogue course),
 * attaching each one's course count and sorting by code. `courseCounts` maps an
 * upper-cased discipline prefix to its number of catalogue courses.
 */
export function disciplinesForFaculty(
  disciplines: Discipline[] | null,
  facultyId: string,
  courseCounts: Map<string, number>,
): FacultyDisciplineEntry[] {
  if (!disciplines) return [];
  return disciplines
    .filter((d) => d.facultyId === facultyId)
    .map((discipline) => ({
      discipline,
      courseCount: courseCounts.get(discipline.code.toUpperCase()) ?? 0,
    }))
    .filter((entry) => entry.courseCount > 0)
    .sort((a, b) => a.discipline.code.localeCompare(b.discipline.code, "en"));
}
