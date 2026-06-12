import { page } from "vitest/browser";
import { expect, test } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, RemainingRequirement, SchedulesData } from "@uoplan/core";

import { AdvancedGenerationOptions } from "./AdvancedGenerationOptions";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testCourseCode } from "../../test/brands";
import { testScheduledCourse } from "../../test/courseScheduleFixtures";

const COURSES = ["CSI 2110", "CSI 2120"];

function buildCache() {
  const catalogue: Catalogue = {
    courses: COURSES.map((c) => ({
      code: testCourseCode(c),
      title: c,
      credits: 3,
      description: "",
    })),
    programs: [],
  };
  const schedules: SchedulesData = { termId: "0000", schedules: COURSES.map(testScheduledCourse) };
  return buildDataCache(catalogue, schedules);
}

const remainingRequirements: RemainingRequirement[] = [
  {
    requirementId: "req-csi",
    type: "group",
    title: "CSI requirement",
    candidateCourses: ["CSI 2110", "CSI 2120"],
    creditsNeeded: 6,
    satisfiedBy: [],
  },
];

test("persists desired courses into constrainedPerRequirement without looping", async () => {
  const cache = buildCache();
  const { store } = await renderWithProviders(<AdvancedGenerationOptions />, {
    initialState: {
      cache,
      remainingRequirements,
      studentPrograms: ["honours-cs"],
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      basketCourses: ["CSI 2110"],
    },
  });

  // The effect reconciles the desired course into the requirement and then stabilises.
  await expect
    .poll(() => store.getState().constrainedPerRequirement["req-csi"])
    .toEqual(["CSI 2110"]);
  expect(store.getState().autoConstrainedPerRequirement).toEqual({ "req-csi": ["CSI 2110"] });

  // The embedded basket shows it counts toward the requirement.
  await expect
    .element(page.getByText("Counts toward CSI requirement", { exact: false }))
    .toBeInTheDocument();
});

test("surfaces an overflow status when desired courses exceed a partly-consumed requirement", async () => {
  const cache = buildCache();
  // The single 3-credit requirement is already half-consumed by an auto-assigned completed course
  // (selectedPerRequirement). A second desired course matching the same requirement overflows.
  const reqs: RemainingRequirement[] = [
    {
      requirementId: "req-csi",
      type: "group",
      title: "CSI requirement",
      candidateCourses: ["CSI 2110", "CSI 2120"],
      creditsNeeded: 3,
      satisfiedBy: [],
    },
  ];
  await renderWithProviders(<AdvancedGenerationOptions />, {
    initialState: {
      cache,
      remainingRequirements: reqs,
      studentPrograms: ["honours-cs"],
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      selectedPerRequirement: { "req-csi": ["CSI 2110"] },
      basketCourses: ["CSI 2120"],
    },
  });

  // The embedded basket flags the overflowing course inline.
  await expect
    .element(page.getByText("Matching requirement is already full", { exact: false }))
    .toBeInTheDocument();
});
