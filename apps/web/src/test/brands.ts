import { pickCanonicalProfessorName, unsafeBrand } from "@uoplan/core";
import type { CanonicalProfessorName, NormalizedCourseCode } from "@uoplan/core";

export const testCourseCode = (value: string): NormalizedCourseCode =>
  unsafeBrand<NormalizedCourseCode>(value);

export const testProfessorName = (value: string): CanonicalProfessorName =>
  pickCanonicalProfessorName([value]);
