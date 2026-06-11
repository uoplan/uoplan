import {
  pickCanonicalProfessorName,
  unsafeBrand,
  type CanonicalProfessorName,
  type NormalizedCourseCode,
} from "@uoplan/core";

export const testCourseCode = (value: string): NormalizedCourseCode =>
  unsafeBrand<NormalizedCourseCode>(value);

export const testProfessorName = (value: string): CanonicalProfessorName =>
  pickCanonicalProfessorName([value]);
