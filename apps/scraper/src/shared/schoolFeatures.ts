import { getSchool } from "@uoplan/domain/school";
import type { SchoolFeatures, SchoolId } from "@uoplan/domain/school";

export function assertSchoolFeature(
  school: SchoolId,
  feature: keyof SchoolFeatures,
  message: string,
): void {
  if (!getSchool(school).features[feature]) throw new Error(message);
}
