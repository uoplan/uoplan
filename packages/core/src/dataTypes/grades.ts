import type {
  GradeProfessorOffering as ProtoGradeProfessorOffering,
  GradesData as ProtoGradesData,
} from "@uoplan/proto/data";
import type { GradeDistribution } from "./domain";

export function fromProtoDistribution(
  distribution:
    | {
        aPlus: number;
        a: number;
        aMinus: number;
        bPlus: number;
        b: number;
        cPlus: number;
        c: number;
        dPlus: number;
        d: number;
        e: number;
        f: number;
        ein: number;
        ns: number;
        nc: number;
        abs: number;
        p: number;
        s: number;
      }
    | undefined,
): GradeDistribution | undefined {
  if (!distribution) return undefined;
  const out: GradeDistribution = {
    "A+": Number(distribution.aPlus),
    A: Number(distribution.a),
    "A-": Number(distribution.aMinus),
    "B+": Number(distribution.bPlus),
    B: Number(distribution.b),
    "C+": Number(distribution.cPlus),
    C: Number(distribution.c),
    "D+": Number(distribution.dPlus),
    D: Number(distribution.d),
    E: Number(distribution.e),
    F: Number(distribution.f),
    EIN: Number(distribution.ein),
    NS: Number(distribution.ns),
    NC: Number(distribution.nc),
    ABS: Number(distribution.abs),
    P: Number(distribution.p),
    S: Number(distribution.s),
  };
  if (Object.values(out).every((v) => v === 0)) return undefined;
  return out;
}

export type CourseGradesProfessor = {
  name: string;
  legacyId?: number;
  termId: number;
  distribution: GradeDistribution;
  section?: string;
};

export type CourseGradesEntry = {
  code: string;
  professors: CourseGradesProfessor[];
};

export type CourseGradesData = {
  courses: CourseGradesEntry[];
};

export function fromProtoCourseGradesData(input: ProtoGradesData): CourseGradesData {
  const courses: CourseGradesEntry[] = [];
  for (const c of input.courses ?? []) {
    const professors: CourseGradesProfessor[] = [];
    for (const p of c.professors ?? []) {
      const row = fromProtoGradeProfessorOfferingRow(p);
      if (row) professors.push(row);
    }
    if (professors.length > 0) {
      courses.push({ code: c.code, professors });
    }
  }
  return { courses };
}

function fromProtoGradeProfessorOfferingRow(
  p: ProtoGradeProfessorOffering,
): CourseGradesProfessor | null {
  const distribution = fromProtoDistribution(p.distribution);
  if (!distribution) return null;
  return {
    name: p.name,
    ...(p.legacyId !== undefined ? { legacyId: Number(p.legacyId) } : {}),
    termId: Number(p.termId),
    distribution,
    ...(p.section ? { section: p.section } : {}),
  };
}
