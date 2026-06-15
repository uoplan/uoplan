import { describe, expect, it } from "vitest";
import { computeStillNeeded } from "@uoplan/core";
import type { ComputeStillNeededParams, DesiredCourseResolution } from "@uoplan/core";
import { buildCache, req } from "../../test/generationFixtures";

const EMPTY_RESOLUTION: DesiredCourseResolution = {
  assigned: {},
  standalone: [],
  prereqUnmet: [],
  noRequirement: [],
  overflow: [],
  completed: [],
  unavailable: [],
};

function run(overrides: Partial<ComputeStillNeededParams>) {
  return computeStillNeeded({
    remainingRequirements: [],
    resolution: EMPTY_RESOLUTION,
    completedCourses: [],
    constrainedPerRequirement: {},
    selectedPerRequirement: {},
    prereqEligibleCourses: [],
    basketCourses: [],
    cache: buildCache(),
    ...overrides,
  });
}

describe("computeStillNeeded", () => {
  it("reports an uncovered requirement with prereq-eligible, offered suggestions first", () => {
    const result = run({
      remainingRequirements: [req("req-csi", "group", ["NOS 9999", "CSI 2110", "CSI 2120"], 6)],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      requirementId: "req-csi",
      creditsNeeded: 6,
      creditsCovered: 0,
    });
    // CSI 2110/2120 are prereq-eligible + offered → before the unavailable NOS 9999.
    expect(result[0].suggestions).toEqual(["CSI 2110", "CSI 2120", "NOS 9999"]);
  });

  it("omits a requirement the basket already covers", () => {
    const result = run({
      remainingRequirements: [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 6)],
      resolution: { ...EMPTY_RESOLUTION, assigned: { "req-csi": ["CSI 2110", "CSI 2120"] } },
      basketCourses: ["CSI 2110", "CSI 2120"],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
    });

    expect(result).toEqual([]);
  });

  it("counts completed/locked picks toward coverage and excludes them from suggestions", () => {
    const result = run({
      remainingRequirements: [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 6)],
      selectedPerRequirement: { "req-csi": ["CSI 2110"] },
      completedCourses: ["CSI 2110"],
      prereqEligibleCourses: ["CSI 2120"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].creditsCovered).toBe(3);
    expect(result[0].suggestions).toEqual(["CSI 2120"]);
    // The defining pool keeps the completed course so the requirement can still be
    // labelled by its full course list, even though it is excluded from suggestions.
    expect(result[0].courseList).toEqual(["CSI 2110", "CSI 2120"]);
  });

  it("excludes courses already in the basket from suggestions", () => {
    const result = run({
      remainingRequirements: [req("req-csi", "group", ["CSI 2110", "CSI 2120"], 6)],
      basketCourses: ["CSI 2110"],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].suggestions).toEqual(["CSI 2120"]);
  });

  it("caps suggestions per requirement", () => {
    const result = run({
      remainingRequirements: [
        req("req-any", "group", ["CSI 2110", "CSI 2120", "MAT 1320", "MAT 1322", "PHI 1101"], 30),
      ],
      maxSuggestionsPerRequirement: 2,
    });

    expect(result[0].suggestions).toHaveLength(2);
    expect(result[0].suggestionPoolSize).toBe(5);
  });

  it("skips uncapped (non-positive credit) requirements", () => {
    const result = run({
      remainingRequirements: [req("req-csi", "group", ["CSI 2110"], 0)],
    });

    expect(result).toEqual([]);
  });

  it("returns nothing without a data cache", () => {
    const result = computeStillNeeded({
      remainingRequirements: [req("req-csi", "group", ["CSI 2110"], 3)],
      resolution: EMPTY_RESOLUTION,
      completedCourses: [],
      constrainedPerRequirement: {},
      selectedPerRequirement: {},
      prereqEligibleCourses: [],
      basketCourses: [],
      cache: null,
    });

    expect(result).toEqual([]);
  });
});
