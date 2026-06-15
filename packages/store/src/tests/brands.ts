import { unsafeBrand } from "@uoplan/core";
import type { NormalizedCourseCode } from "@uoplan/core";

export const testCourseCode = (value: string): NormalizedCourseCode =>
  unsafeBrand<NormalizedCourseCode>(value);
