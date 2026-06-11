import { describe, expect, it } from "vitest";
import type { Catalogue, RemainingRequirement, SchedulesData } from "@uoplan/core";
import { buildDataCache } from "@uoplan/core";
import { resolveDesiredCourses } from "./resolveDesiredCourses";
import { testCourseCode } from "../../test/brands";
import { testScheduledCourse } from "../../test/courseScheduleFixtures";

function mkCourse(code: string, credits = 3) {
  return { code: testCourseCode(code), title: code, credits, description: "" };
}

// CSI 2110/2120 + MAT 1320/1322 + PHI 1101 are offered; NOS 9999 has no schedule row.
const SCHEDULED = ["CSI 2110", "CSI 2120", "MAT 1320", "MAT 1322", "PHI 1101"];

function buildCache() {
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

function req(
  requirementId: string,
  type: string,
  candidateCourses: string[],
  creditsNeeded: number,
): RemainingRequirement {
  return { requirementId, type, candidateCourses, creditsNeeded, satisfiedBy: [] };
}

describe("resolveDesiredCourses", () => {
  it("assigns a prereq-eligible desired course to a matching requirement", () => {
    const cache = buildCache();
    const requirements = [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 6)];

    const result = resolveDesiredCourses(
      requirements,
      ["CSI 2110"],
      [],
      {},
      {},
      ["CSI 2110", "CSI 2120"],
      cache,
    );

    expect(result.assigned).toEqual({ "req-csi": ["CSI 2110"] });
    expect(result.standalone).toEqual([]);
    expect(result.noRequirement).toEqual([]);
  });

  it("force-pins a prereq-eligible course that matches no requirement", () => {
    const cache = buildCache();
    const requirements = [req("req-csi", "group", ["CSI 2110"], 3)];

    const result = resolveDesiredCourses(
      requirements,
      ["MAT 1320"],
      [],
      {},
      {},
      ["MAT 1320"],
      cache,
    );

    expect(result.standalone).toContain("MAT 1320");
    expect(result.noRequirement).toContain("MAT 1320");
    expect(result.assigned).toEqual({});
  });

  it("force-pins a prereq-ineligible course and flags it", () => {
    const cache = buildCache();
    const requirements = [req("req-csi", "group", ["CSI 2110"], 3)];

    // CSI 2110 matches a requirement but is NOT prereq-eligible → must be force-pinned, not assigned.
    const result = resolveDesiredCourses(requirements, ["CSI 2110"], [], {}, {}, [], cache);

    expect(result.prereqUnmet).toContain("CSI 2110");
    expect(result.standalone).toContain("CSI 2110");
    expect(result.assigned).toEqual({});
  });

  it("marks completed desired courses without scheduling them", () => {
    const cache = buildCache();
    const result = resolveDesiredCourses(
      [],
      ["CSI 2110"],
      ["CSI 2110"],
      {},
      {},
      ["CSI 2110"],
      cache,
    );

    expect(result.completed).toContain("CSI 2110");
    expect(result.standalone).toEqual([]);
  });

  it("marks desired courses with no sections this term as unavailable", () => {
    const cache = buildCache();
    const result = resolveDesiredCourses([], ["NOS 9999"], [], {}, {}, ["NOS 9999"], cache);

    expect(result.unavailable).toContain("NOS 9999");
    expect(result.standalone).toEqual([]);
  });

  it("flags a desired course as overflow when its only requirement is already saturated", () => {
    const cache = buildCache();
    // req needs 3 credits, already filled by a manual pick → desired CSI 2120 matches but can't fit.
    const requirements = [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 3)];

    const result = resolveDesiredCourses(
      requirements,
      ["CSI 2120"],
      [],
      { "req-csi": ["CSI 2110"] },
      {},
      ["CSI 2110", "CSI 2120"],
      cache,
    );

    expect(result.assigned).toEqual({});
    expect(result.overflow).toContain("CSI 2120");
    expect(result.noRequirement).not.toContain("CSI 2120");
    expect(result.standalone).toContain("CSI 2120");
  });

  it("spreads desired courses across requirements instead of overfilling one", () => {
    const cache = buildCache();
    // A broad 6-credit elective accepts both CSI courses; a specific 3-credit req accepts only 2110.
    // CSI 2110 (scarcer, 2 homes) must claim the specific req so CSI 2120 isn't crowded out.
    const requirements = [
      req("req-specific", "group", ["CSI 2110"], 3),
      req("req-broad", "elective", ["CSI 2110", "CSI 2120"], 6),
    ];

    const result = resolveDesiredCourses(
      requirements,
      ["CSI 2120", "CSI 2110"],
      [],
      {},
      {},
      ["CSI 2110", "CSI 2120"],
      cache,
    );

    expect(result.assigned["req-specific"]).toEqual(["CSI 2110"]);
    expect(result.assigned["req-broad"]).toEqual(["CSI 2120"]);
    expect(result.overflow).toEqual([]);
    expect(result.noRequirement).toEqual([]);
  });

  it("overflows extra courses once every matching requirement is full", () => {
    const cache = buildCache();
    // One specific 3-credit requirement; two desired courses compete for the single slot.
    const requirements = [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 3)];

    const result = resolveDesiredCourses(
      requirements,
      ["CSI 2110", "CSI 2120"],
      [],
      {},
      {},
      ["CSI 2110", "CSI 2120"],
      cache,
    );

    const assignedCodes = Object.values(result.assigned).flat();
    expect(assignedCodes).toHaveLength(1);
    expect(result.overflow).toHaveLength(1);
    expect([...assignedCodes, ...result.overflow].sort()).toEqual(["CSI 2110", "CSI 2120"]);
  });

  it("treats selectedPerRequirement capacity as consumed (overflows when slot already taken)", () => {
    const cache = buildCache();
    // A 3-credit requirement whose single slot is already consumed by a completed/auto-assigned
    // course (selectedPerRequirement). A desired course matching the same requirement overflows.
    const requirements = [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 3)];

    const result = resolveDesiredCourses(
      requirements,
      ["CSI 2120"],
      [],
      {},
      { "req-csi": ["CSI 2110"] },
      ["CSI 2110", "CSI 2120"],
      cache,
    );

    expect(result.assigned).toEqual({});
    expect(result.overflow).toContain("CSI 2120");
  });
});
