import type { ExploreOfferingFlat } from "../lib/explore/gradesSearch";
import { testCourseCode, testProfessorName } from "./brands";

export type OfferingPartial = Partial<Omit<ExploreOfferingFlat, "courseCode" | "professorName">> & {
  courseCode?: string;
  professorName?: string;
};

export function makeOffering(partial: OfferingPartial): ExploreOfferingFlat {
  return {
    id: partial.id ?? "offering",
    courseCode: testCourseCode(partial.courseCode ?? "CSI 1100"),
    courseTitle: partial.courseTitle ?? "Intro",
    professorName: testProfessorName(partial.professorName ?? "Ada Lovelace"),
    legacyId: partial.legacyId,
    professorRef: partial.professorRef,
    unassignedInstructor: partial.unassignedInstructor,
    predictedInstructors: partial.predictedInstructors,
    termId: partial.termId ?? 2269,
    termLabel: partial.termLabel ?? "Fall 2026",
    section: partial.section,
    fuseText: partial.fuseText ?? "",
    distribution: partial.distribution ?? {},
  };
}
