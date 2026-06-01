/**
 * Behavioural tests for the `forcedCourses` advanced-generation parameter: "courses you want"
 * that are force-pinned regardless of requirement membership or prerequisite eligibility.
 */
import { describe, expect, it } from "vitest";
import { generateAdvancedSchedule } from "../../../generateSchedule";
import type { RemainingRequirement } from "../../../requirements";
import { ALL_FIXTURE_CODES, baseAdvancedParams, buildFixtureCache } from "./fixtures";

function req(
  requirementId: string,
  type: string,
  candidateCourses: string[],
  creditsNeeded: number,
): RemainingRequirement {
  return { requirementId, type, candidateCourses, creditsNeeded, satisfiedBy: [] };
}

describe("generateAdvancedSchedule forcedCourses", () => {
  it("schedules a forced course whose prerequisites are not met", () => {
    const cache = buildFixtureCache();
    const params = baseAdvancedParams(cache);
    // Nothing is prereq-eligible, so SEG 2105 can only appear because it is force-pinned.
    params.prereqEligibleCourses = [];
    params.remainingRequirements = [];
    params.forcedCourses = ["SEG 2105"];
    params.coursesThisSemester = 1;

    const result = generateAdvancedSchedule(params);

    expect(result.pinned).toContain("SEG 2105");
    expect(result.schedule).not.toBeNull();
    expect(result.schedule!.enrollments.map((e) => e.courseCode)).toContain("SEG 2105");
  });

  it("schedules a forced course that matches no remaining requirement alongside the target", () => {
    const cache = buildFixtureCache();
    const params = baseAdvancedParams(cache);
    params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
    // SEG 2105 is in no requirement; the elective pool fills the rest.
    params.remainingRequirements = [
      req("req-elec", "elective", ["PHI 1101", "HIS 1100", "MAT 1320", "MAT 1322"], 6),
    ];
    params.forcedCourses = ["SEG 2105"];
    params.coursesThisSemester = 2;

    const result = generateAdvancedSchedule(params);

    expect(result.pinned).toContain("SEG 2105");
    const courseSet = result.schedule!.enrollments.map((e) => e.courseCode);
    expect(courseSet).toContain("SEG 2105");
    expect(courseSet).toHaveLength(2);
  });

  it("clamps the target up to the pinned count when forced courses over-fill the semester", () => {
    const cache = buildFixtureCache();
    const params = baseAdvancedParams(cache);
    params.prereqEligibleCourses = [];
    params.remainingRequirements = [];
    // Three time-compatible forced courses but only room for one — all should still be scheduled.
    params.forcedCourses = ["SEG 2105", "MAT 1320", "PHI 1101"];
    params.coursesThisSemester = 1;

    const result = generateAdvancedSchedule(params);

    expect(result.schedule).not.toBeNull();
    const courseSet = result.schedule!.enrollments.map((e) => e.courseCode).sort();
    expect(courseSet).toEqual(["MAT 1320", "PHI 1101", "SEG 2105"]);
  });

  it("ignores a forced course that is not offered this term", () => {
    const cache = buildFixtureCache();
    const params = baseAdvancedParams(cache);
    params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
    params.remainingRequirements = [];
    params.forcedCourses = ["ZZZ 9999"];
    params.coursesThisSemester = 1;

    const result = generateAdvancedSchedule(params);

    expect(result.pinned).not.toContain("ZZZ 9999");
  });

  it("ignores a forced course the student has already completed", () => {
    const cache = buildFixtureCache();
    const params = baseAdvancedParams(cache);
    params.prereqEligibleCourses = [...ALL_FIXTURE_CODES];
    params.completedCourses = ["SEG 2105"];
    params.remainingRequirements = [];
    params.forcedCourses = ["SEG 2105"];
    params.coursesThisSemester = 1;

    const result = generateAdvancedSchedule(params);

    expect(result.pinned).not.toContain("SEG 2105");
  });
});
