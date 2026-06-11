import { page } from "vitest/browser";
import { expect, test } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, CourseSchedule, RemainingRequirement, SchedulesData } from "@uoplan/core";

import { AdvancedGenerationOptions } from "./AdvancedGenerationOptions";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testCourseCode } from "../../test/brands";

function mkSchedule(code: string): CourseSchedule {
  const [subject, catalogNumber] = code.split(/\s+/);
  return {
    subject,
    catalogNumber,
    courseCode: testCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components: {
      LEC: [
        {
          section: "A",
          sectionCode: "A",
          component: "LEC",
          session: null,
          status: null,
          times: [
            { day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false, instructor: null },
          ],
        },
      ],
    },
  };
}

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
  const schedules: SchedulesData = { termId: "0000", schedules: COURSES.map(mkSchedule) };
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
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      basicPinnedCourses: ["CSI 2110"],
    },
  });

  // The effect reconciles the desired course into the requirement and then stabilises.
  await expect
    .poll(() => store.getState().constrainedPerRequirement["req-csi"])
    .toEqual(["CSI 2110"]);
  expect(store.getState().autoConstrainedPerRequirement).toEqual({ "req-csi": ["CSI 2110"] });

  // The sidebar shows it counts toward the requirement.
  await expect.element(page.getByText("CSI requirement", { exact: false })).toBeInTheDocument();
});

test("excludes completed courses from the desired-courses dropdown", async () => {
  const cache = buildCache();
  await renderWithProviders(<AdvancedGenerationOptions />, {
    initialState: {
      cache,
      remainingRequirements,
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      completedCourses: ["CSI 2120"],
      basicPinnedCourses: [],
    },
  });

  const input = page.getByRole("combobox", { name: "Courses you want" });
  await input.click();

  // The not-yet-taken course is offered; the completed one is filtered out.
  await expect.element(page.getByRole("option", { name: "CSI 2110" })).toBeInTheDocument();
  // Scope to the course dropdown (other multiselects keep their options mounted too).
  const inputEl = input.element() as HTMLInputElement;
  const listbox = document.querySelector(`[role="listbox"][aria-labelledby="${inputEl.id}-label"]`);
  const csiOptions = [...(listbox?.querySelectorAll('[role="option"]') ?? [])].map(
    (el) => el.textContent ?? "",
  );
  expect(csiOptions.some((t) => t.includes("CSI 2110"))).toBe(true);
  expect(csiOptions.some((t) => t.includes("CSI 2120"))).toBe(false);
});

test("surfaces an overflow warning when desired courses exceed a partly-consumed requirement", async () => {
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
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      selectedPerRequirement: { "req-csi": ["CSI 2110"] },
      basicPinnedCourses: ["CSI 2120"],
    },
  });

  // The overflow warning is surfaced at the top, under the course selection.
  await expect.element(page.getByText("Requirement already full")).toBeInTheDocument();
});
