import { GRADE_KEYS, normalizeCode } from "./shared.ts";
import type { CourseGradeEntry, DisciplinesData, GradesData } from "@uoplan/proto/data";
import type { ProfessorResolver } from "../professors/buildRegistry.ts";

/** Convert a 0-based registry index (or null) to a 1-based proto ref (0 = none). */
function toProfessorRef(
  resolver: ProfessorResolver | undefined,
  name: string,
  legacyId?: number,
): number {
  if (!resolver) return 0;
  const idx = resolver.index(name, legacyId);
  return idx == null ? 0 : idx + 1;
}

interface GradeProfessorInput {
  name?: string;
  legacyId?: string | number;
  termId?: string | number;
  distribution?: unknown;
  section?: string;
}

interface GradeCourseInput {
  code?: string;
  professors?: unknown;
}

/** Flatten a distribution object into the 18 canonical `GRADE_KEYS` columns. */
function distributionColumns(dist: unknown): number[] {
  const d = dist && typeof dist === "object" ? (dist as Record<string, unknown>) : {};
  return GRADE_KEYS.map((k) => {
    const num = Number(d[k]);
    return Number.isFinite(num) ? num : 0;
  });
}

function parseLegacyId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

interface NormalizedOffering {
  name: string;
  legacyId?: number;
  termId: number;
  section: string;
  distribution: number[];
}

function normalizeOffering(p: unknown): NormalizedOffering {
  const x = p as GradeProfessorInput;
  const termParsed = Number.parseInt(String(x.termId ?? ""), 10);
  const termId = Number.isFinite(termParsed) ? termParsed : 0;
  const section = typeof x.section === "string" && x.section.trim() ? x.section.trim() : "";
  return {
    name: String(x.name ?? ""),
    legacyId: parseLegacyId(x.legacyId),
    termId,
    section,
    distribution: distributionColumns(x.distribution),
  };
}

/**
 * Encode `grades.json` into the column-wise {@link GradesData}: one
 * {@link CourseGradeEntry} per course with parallel offering columns, plus a
 * shared `professorNames` dictionary referenced 0-based by `nameRefs`.
 */
export function mapGradesJson(rows: unknown[], resolver?: ProfessorResolver): GradesData {
  if (!Array.isArray(rows)) {
    throw new Error("grades.json: expected top-level array");
  }

  const professorNames: string[] = [];
  const nameIndex = new Map<string, number>();
  const nameRefOf = (name: string): number => {
    const existing = nameIndex.get(name);
    if (existing !== undefined) return existing;
    const idx = professorNames.length;
    professorNames.push(name);
    nameIndex.set(name, idx);
    return idx;
  };

  const courses: CourseGradeEntry[] = [];
  for (const row of rows) {
    const r = row as GradeCourseInput;
    const offerings = (Array.isArray(r.professors) ? r.professors : [])
      .map(normalizeOffering)
      .filter((o) => o.termId !== 0 && o.name.trim().length > 0);
    if (offerings.length === 0) continue;

    const entry: CourseGradeEntry = {
      code: normalizeCode(r.code),
      nameRefs: [],
      termIds: [],
      professorRefs: [],
      legacyIds: [],
      sections: [],
      distributions: [],
    };
    for (const o of offerings) {
      entry.nameRefs.push(nameRefOf(o.name));
      entry.termIds.push(o.termId);
      entry.professorRefs.push(toProfessorRef(resolver, o.name, o.legacyId));
      entry.legacyIds.push(o.legacyId ?? 0);
      entry.sections.push(o.section);
      entry.distributions.push(...o.distribution);
    }
    courses.push(entry);
  }

  return { courses, professorNames };
}

export function mapDisciplinesJson(input: unknown): DisciplinesData {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const facultyRows = Array.isArray(obj.faculties) ? obj.faculties : [];
  const disciplineRows = Array.isArray(obj.disciplines) ? obj.disciplines : [];

  const faculties = facultyRows
    .map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const nameFr = typeof r.nameFr === "string" ? r.nameFr.trim() : "";
      // `id` is kept only as the JSON↔discipline linking key (to build faculty_ref);
      // it is not stored in the proto — it's re-derived from `name` at decode time.
      if (!id || !name) return null;
      return { id, name, nameFr };
    })
    .filter((row): row is { id: string; name: string; nameFr: string } => row != null);

  // 1-based index into `faculties`; 0/absent = unknown faculty.
  const facultyRefById = new Map<string, number>();
  for (const [index, faculty] of faculties.entries()) {
    facultyRefById.set(faculty.id, index + 1);
  }

  const disciplines = disciplineRows
    .map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const code = normalizeCode(r.code);
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const nameFr = typeof r.nameFr === "string" ? r.nameFr.trim() : "";
      const facultyId = typeof r.faculty === "string" ? r.faculty.trim() : "";
      if (!code || !name) return null;
      const facultyRef = facultyId ? facultyRefById.get(facultyId) : undefined;
      return { code, name, nameFr, ...(facultyRef ? { facultyRef } : {}) };
    })
    .filter(
      (row): row is { code: string; name: string; nameFr: string; facultyRef?: number } =>
        row != null,
    );

  return {
    faculties: faculties.map(({ name, nameFr }) => ({ name, nameFr })),
    disciplines,
  };
}
