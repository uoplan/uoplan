import type { Catalogue, RemainingRequirement, SchedulesData } from "@uoplan/core";
import { buildDataCache } from "@uoplan/core";
import { testCourseCode } from "./brands";
import { testScheduledCourse } from "./courseScheduleFixtures";

function mkCourse(code: string, credits = 3) {
  return { code: testCourseCode(code), title: code, credits, description: "" };
}

// CSI 2110/2120 + MAT 1320/1322 + PHI 1101 are offered; NOS 9999 has no schedule row.
const SCHEDULED = ["CSI 2110", "CSI 2120", "MAT 1320", "MAT 1322", "PHI 1101"];

export function buildCache() {
  const catalogue: Catalogue = {
    courses: [...SCHEDULED, "NOS 9999"].map((c) => mkCourse(c)),
    programs: [],
  };
  const schedules: SchedulesData = {
    termId: "0000",
    schedules: SCHEDULED.map(testScheduledCourse),
  };
  return buildDataCache(catalogue, schedules);
}

export function req(
  requirementId: string,
  type: string,
  candidateCourses: string[],
  creditsNeeded: number,
): RemainingRequirement {
  return { requirementId, type, candidateCourses, creditsNeeded, satisfiedBy: [] };
}
