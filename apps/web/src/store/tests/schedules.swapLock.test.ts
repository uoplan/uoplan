import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildDataCache, normalizeCourseCode } from "@uoplan/schedule";
import type {
  Catalogue,
  GeneratedSchedule,
  RemainingRequirement,
  RequirementWithStatus,
} from "@uoplan/schedule";
import { useAppStore } from "../appStore";

let mockCalendarVariant: "basic" | "advanced" | null = null;

vi.mock("../../lib/calendarRoute", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/calendarRoute")>();
  return {
    ...actual,
    getActiveCalendarVariant: () => mockCalendarVariant,
    isBasicPlannerActive: () => mockCalendarVariant === "basic",
    isAdvancedPlannerActive: () => mockCalendarVariant === "advanced",
    isPlannerVariantActive: () => mockCalendarVariant != null,
  };
});

const testCatalogue: Catalogue = {
  courses: [
    { code: "CSI 2132", title: "CSI 2132", credits: 3, description: "", component: "LEC" },
    { code: "MAT 1341", title: "MAT 1341", credits: 3, description: "", component: "LEC" },
  ],
  programs: [],
};

const cache = buildDataCache(testCatalogue, { termId: "2261", schedules: [] });

function makeSchedule(courseCode: string): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode,
        sectionCombo: {
          LEC: {
            section: {
              section: "A",
              sectionCode: null,
              component: "LEC",
              session: null,
              times: [],
              status: null,
            },
          },
        },
        times: [{ day: "Mo", startMinutes: 600, endMinutes: 750 }],
      },
    ],
  };
}

function makeRemainingReq(id: string, candidates: string[]): RemainingRequirement {
  return {
    requirementId: id,
    type: "elective",
    title: "Elective",
    candidateCourses: candidates,
    creditsNeeded: 6,
    satisfiedBy: [],
  };
}

const electiveTree: RequirementWithStatus[] = [
  {
    type: "elective",
    title: "Elective",
    complete: false,
    satisfiedBy: [],
    creditsNeeded: 6,
    requirementId: "req-elective",
    candidateCourses: ["CSI 2132", "MAT 1341"],
  },
];

describe("lockCourseForAllSchedulesFromSwap / unlockCourseForAllSchedulesFromSwap", () => {
  beforeEach(() => {
    mockCalendarVariant = null;
    useAppStore.setState({
      ...useAppStore.getState(),
      basicPinnedCourses: [],
      constrainedPerRequirement: {},
      selectedPerRequirement: {},
      currentSchedule: null,
      cache,
    });
  });

  it("pins and unpins a course in basic mode", () => {
    mockCalendarVariant = "basic";
    useAppStore.setState({
      basicElectivesCount: 3,
      currentSchedule: makeSchedule("CSI 2132"),
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().basicPinnedCourses).toEqual(["CSI 2132"]);
    expect(useAppStore.getState().basicElectivesCount).toBe(2);

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().basicPinnedCourses).toEqual(["CSI 2132"]);
    expect(useAppStore.getState().basicElectivesCount).toBe(2);

    useAppStore.getState().unlockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().basicPinnedCourses).toEqual([]);
    expect(useAppStore.getState().basicElectivesCount).toBe(3);
  });

  it("pins and unpins across constrained requirements in advanced mode", () => {
    mockCalendarVariant = "advanced";
    useAppStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      currentPoolMap: { "CSI 2132": "req-elective" },
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().constrainedPerRequirement).toEqual({
      "req-elective": ["CSI 2132"],
    });

    useAppStore.getState().unlockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().constrainedPerRequirement).toEqual({});
  });

  it("does not duplicate when already in constrainedPerRequirement", () => {
    mockCalendarVariant = "advanced";
    useAppStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      constrainedPerRequirement: { "req-elective": ["CSI 2132"] },
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().constrainedPerRequirement).toEqual({
      "req-elective": ["CSI 2132"],
    });
  });

  it("does not add to constrain when already in selectedPerRequirement for that requirement", () => {
    mockCalendarVariant = "advanced";
    useAppStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      selectedPerRequirement: { "req-elective": ["CSI 2132"] },
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().constrainedPerRequirement).toEqual({});
  });

  it("locks to the most restrictive requirement when multiple requirements match", () => {
    mockCalendarVariant = "advanced";
    const specificTree: RequirementWithStatus[] = [
      {
        type: "course",
        title: "Specific Course",
        complete: false,
        satisfiedBy: [],
        creditsNeeded: 3,
        requirementId: "req-specific",
        candidateCourses: ["CSI 2132"],
      },
      {
        type: "free_elective",
        title: "Free Elective",
        complete: false,
        satisfiedBy: [],
        creditsNeeded: 9,
        requirementId: "req-free",
        candidateCourses: ["CSI 2132", "MAT 1341", "PHI 1101"],
      },
    ];
    useAppStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: specificTree,
      remainingRequirements: [
        { ...makeRemainingReq("req-specific", ["CSI 2132"]), type: "course", creditsNeeded: 3 },
        {
          ...makeRemainingReq("req-free", ["CSI 2132", "MAT 1341", "PHI 1101"]),
          type: "free_elective",
          creditsNeeded: 9,
        },
      ],
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    const state = useAppStore.getState().constrainedPerRequirement;
    expect(state["req-specific"]).toEqual(["CSI 2132"]);
    expect(state["req-free"]).toBeUndefined();
  });

  it("does not append a second alias for the same normalized course", () => {
    mockCalendarVariant = "advanced";
    useAppStore.setState({
      currentSchedule: makeSchedule("CSI2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      constrainedPerRequirement: { "req-elective": ["CSI2132"] },
      currentPoolMap: { CSI2132: "req-elective" },
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    const codes = useAppStore.getState().constrainedPerRequirement["req-elective"] ?? [];
    expect(codes).toHaveLength(1);
    expect(normalizeCourseCode(codes[0])).toBe(normalizeCourseCode("CSI 2132"));
  });
});
