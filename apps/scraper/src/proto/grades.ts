import { normalizeCode } from "./shared.ts";
import type { GradeDistribution } from "@uoplan/proto/data";
import type { ProfessorResolver } from "../professors/buildRegistry.ts";

/** Convert a 0-based registry index (or null) to a 1-based proto ref (undefined = none). */
function toProfessorRef(resolver: ProfessorResolver | undefined, name: string, legacyId?: number) {
  if (!resolver) return;
  const idx = resolver.index(name, legacyId);
  return idx == null ? undefined : idx + 1;
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

function mapLetterGradeDistributionToProto(dist: unknown): GradeDistribution {
  const d = dist && typeof dist === "object" ? (dist as Record<string, unknown>) : {};
  const n = (k: string): number => {
    const v = d[k];
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    aPlus: n("A+"),
    a: n("A"),
    aMinus: n("A-"),
    bPlus: n("B+"),
    b: n("B"),
    cPlus: n("C+"),
    c: n("C"),
    dPlus: n("D+"),
    d: n("D"),
    e: n("E"),
    f: n("F"),
    ein: n("EIN"),
    ns: n("NS"),
    nc: n("NC"),
    abs: n("ABS"),
    p: n("P"),
    s: n("S"),
  };
}

function parseLegacyId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function mapProfessor(p: unknown, resolver?: ProfessorResolver) {
  const x = p as GradeProfessorInput;
  const termParsed = Number.parseInt(String(x.termId ?? ""), 10);
  const termId = Number.isFinite(termParsed) ? termParsed : 0;
  const sec = typeof x.section === "string" && x.section.trim() ? x.section.trim() : undefined;
  const legacyId = parseLegacyId(x.legacyId);
  const name = String(x.name ?? "");
  return {
    name,
    ...(legacyId !== undefined ? { legacyId } : {}),
    termId,
    distribution: mapLetterGradeDistributionToProto(x.distribution),
    section: sec,
    professorRef: toProfessorRef(resolver, name, legacyId),
  };
}

export function mapGradesJson(rows: unknown[], resolver?: ProfessorResolver) {
  if (!Array.isArray(rows)) {
    throw new Error("grades.json: expected top-level array");
  }

  return {
    courses: rows
      .map((row) => {
        const r = row as GradeCourseInput;
        const profs = Array.isArray(r.professors) ? r.professors : [];
        return {
          code: normalizeCode(r.code),
          professors: profs
            .map((p) => mapProfessor(p, resolver))
            .filter((p) => p.termId !== 0 && String(p.name).trim().length > 0),
        };
      })
      .filter((c) => c.professors.length > 0),
  };
}

export function mapDisciplinesJson(input: unknown): {
  disciplines: Array<{ code: string; name: string; nameFr: string }>;
} {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.disciplines) ? obj.disciplines : [];

  return {
    disciplines: rows
      .map((row) => {
        const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        const code = normalizeCode(r.code);
        const name = typeof r.name === "string" ? r.name.trim() : "";
        const nameFr = typeof r.nameFr === "string" ? r.nameFr.trim() : "";
        if (!code || !name) return null;
        return { code, name, nameFr };
      })
      .filter((row): row is { code: string; name: string; nameFr: string } => row != null),
  };
}
