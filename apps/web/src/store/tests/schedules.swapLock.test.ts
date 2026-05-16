import { describe, it, expect, beforeEach } from "vitest";
import { buildDataCache, normalizeCourseCode } from "schedule";
import type {
  Catalogue,
  GeneratedSchedule,
  RemainingRequirement,
  RequirementWithStatus,
} from "schedule";
import { useAppStore } from "../appStore";

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
              instructors: [],
              meetingDates: null,
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
    useAppStore.setState({
      ...useAppStore.getState(),
      wizardMode: null,
      basicPinnedCourses: [],
      constrainedPerRequirement: {},
      selectedPerRequirement: {},
      currentSchedule: null,
      cache,
    });
  });

  it("pins and unpins a course in basic mode", () => {
    useAppStore.setState({
      wizardMode: "basic",
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
    useAppStore.setState({
      wizardMode: "advanced",
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
    useAppStore.setState({
      wizardMode: "advanced",
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
    useAppStore.setState({
      wizardMode: "advanced",
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      selectedPerRequirement: { "req-elective": ["CSI 2132"] },
    });

    useAppStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(useAppStore.getState().constrainedPerRequirement).toEqual({});
  });

  it("does not append a second alias for the same normalized course", () => {
    useAppStore.setState({
      wizardMode: "advanced",
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
