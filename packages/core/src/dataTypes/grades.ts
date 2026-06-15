import type { GradesData as ProtoGradesData } from "@uoplan/proto/data";
import type { NormalizedCourseCode } from "../brand";
import type { GradeDistribution } from "./domain";
import { normalizeCourseCode } from "../utils/courseUtils";

/**
 * Canonical letter order of the 18 columns packed into
 * `CourseGradeEntry.distributions` (must match the scraper's GRADE_KEYS and the
 * proto comment). Order is significant: the decode below and gradeLookupContract
 * compare distributions via strict JSON.stringify.
 */
const GRADE_KEYS = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "E",
  "F",
  "DR",
  "EIN",
  "NS",
  "NC",
  "ABS",
  "P",
  "S",
] as const;

const GRADE_COLUMN_COUNT = GRADE_KEYS.length;

export function distributionFromColumns(
  columns: number[],
  offset: number,
): GradeDistribution | undefined {
  const out = {} as GradeDistribution;
  let nonZero = false;
  for (let i = 0; i < GRADE_COLUMN_COUNT; i++) {
    const v = Number(columns[offset + i] ?? 0);
    out[GRADE_KEYS[i]] = v;
    if (v !== 0) nonZero = true;
  }
  return nonZero ? out : undefined;
}

export type CourseGradesSection = {
  name?: string;
  legacyId?: number;
  /** 1-based ref into the canonical professor registry (`professors.pb`). */
  professorRef?: number;
  termId: number;
  distribution: GradeDistribution;
  section?: string;
};

export type CourseGradesEntry = {
  code: NormalizedCourseCode;
  sections: CourseGradesSection[];
};

export type CourseGradesData = {
  courses: CourseGradesEntry[];
};

export function fromProtoCourseGradesData(input: ProtoGradesData): CourseGradesData {
  const names = input.sectionNames ?? [];
  const courses: CourseGradesEntry[] = [];
  for (const c of input.courses ?? []) {
    const count = c.termIds?.length ?? 0;
    const sections: CourseGradesSection[] = [];
    for (let i = 0; i < count; i++) {
      const distribution = distributionFromColumns(c.distributions ?? [], i * GRADE_COLUMN_COUNT);
      if (!distribution) continue;
      const legacyId = c.legacyIds?.[i] ?? 0;
      const professorRef = c.professorRefs?.[i] ?? 0;
      const section = c.sections?.[i] ?? "";
      const nameRef = c.nameRefs?.[i] ?? 0;
      const name = names[nameRef] ?? "";
      sections.push({
        ...(name ? { name } : {}),
        ...(legacyId !== 0 ? { legacyId: Number(legacyId) } : {}),
        ...(professorRef !== 0 ? { professorRef: Number(professorRef) } : {}),
        termId: Number(c.termIds?.[i] ?? 0),
        distribution,
        ...(section ? { section } : {}),
      });
    }
    if (sections.length > 0) {
      courses.push({ code: normalizeCourseCode(c.code), sections });
    }
  }
  return { courses };
}
