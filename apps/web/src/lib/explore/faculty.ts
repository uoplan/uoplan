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
