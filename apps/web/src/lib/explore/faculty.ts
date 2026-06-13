import type { Discipline, Faculty } from "@uoplan/core";

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
