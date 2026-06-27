import type { AnchorHTMLAttributes, ReactNode } from "react";
import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, RemainingRequirement, SchedulesData } from "@uoplan/core";

import { AdvancedGenerationOptions } from "./AdvancedGenerationOptions";
import { renderWithProviders } from "../../test/renderWithProviders";
import { testCourseCode } from "../../test/brands";
import { testScheduledCourse } from "../../test/courseScheduleFixtures";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";

interface MockLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode;
  params?: unknown;
  search?: unknown;
  to?: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, params: _params, search: _search, to, ...props }: MockLinkProps) => (
      <a href={to ?? "#"} {...props}>
        {children}
      </a>
    ),
  };
});

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

type AdvancedInitialState = NonNullable<Parameters<typeof renderWithProviders>[1]>["initialState"];

function renderAdvanced(extraState?: AdvancedInitialState) {
  return renderWithProviders(<AdvancedGenerationOptions />, {
    initialState: {
      cache: buildCache(),
      remainingRequirements,
      studentPrograms: ["honours-cs"],
      requirementTreeWithStatus: [],
      prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      filteredPrereqEligibleCourses: ["CSI 2110", "CSI 2120"],
      ...extraState,
    },
  });
}

test("persists desired courses into constrainedPerRequirement without looping", async () => {
  const { store } = await renderAdvanced({ basketCourses: ["CSI 2110"] });

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
  await renderAdvanced({
    remainingRequirements: reqs,
    selectedPerRequirement: { "req-csi": ["CSI 2110"] },
    basketCourses: ["CSI 2120"],
  });

  // The embedded basket flags the overflowing course inline.
  await expect
    .element(page.getByText("Matching requirement is already full", { exact: false }))
    .toBeInTheDocument();
});

test("counts desired advanced courses toward the displayed semester total", async () => {
  const { store } = await renderAdvanced({ basketCourses: ["CSI 2110"], coursesThisSemester: 1 });

  const count = page.getByLabelText("Electives this semester (additional)");
  await expect.element(count).toHaveValue("1");

  await count.fill("0");

  expect(store.getState().coursesThisSemester).toBe(0);
});

test("does not clamp additional electives during basket auto-assignment reconciliation", async () => {
  const { store } = await renderAdvanced({
    basketCourses: ["CSI 2120"],
    constrainedPerRequirement: { "req-csi": ["CSI 2110"] },
    autoConstrainedPerRequirement: { "req-csi": ["CSI 2110"] },
    coursesThisSemester: 1,
  });

  await expect
    .poll(() => store.getState().constrainedPerRequirement["req-csi"])
    .toEqual(["CSI 2120"]);
  expect(store.getState().coursesThisSemester).toBe(1);
});

test("caps additional electives at zero when there are no remaining requirement pools", async () => {
  const { store } = await renderAdvanced({ remainingRequirements: [], coursesThisSemester: 2 });

  await expect.poll(() => store.getState().coursesThisSemester).toBe(0);
  await expect
    .element(page.getByLabelText("Electives this semester (additional)"))
    .toHaveValue("0");
});

test("counts group-token picks against the advanced additional-elective cap", async () => {
  const highCapacityRequirement: RemainingRequirement[] = [
    {
      ...remainingRequirements[0],
      creditsNeeded: 30,
    },
  ];
  const { store } = await renderAdvanced({
    remainingRequirements: highCapacityRequirement,
    constrainedPerRequirement: { "req-csi": ["group:CSI~a", "group:CSI~b"] },
    coursesThisSemester: SCHEDULE_COURSE_COUNT_MAX,
  });

  await expect.poll(() => store.getState().coursesThisSemester).toBe(8);
});
