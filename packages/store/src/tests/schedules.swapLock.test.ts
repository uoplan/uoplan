import { beforeEach, describe, expect, it } from "vitest";
import { buildDataCache, normalizeCourseCode } from "@uoplan/core";
import type {
  Catalogue,
  GeneratedSchedule,
  RemainingRequirement,
  RequirementWithStatus,
} from "@uoplan/core";
import { testCourseCode } from "./brands";
import { testStore } from "./scheduleStoreHelpers";

const testCatalogue: Catalogue = {
  courses: [
    {
      code: testCourseCode("CSI 2132"),
      title: "CSI 2132",
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: testCourseCode("MAT 1341"),
      title: "MAT 1341",
      credits: 3,
      description: "",
      component: "LEC",
    },
  ],
  programs: [],
};

const cache = buildDataCache(testCatalogue, { termId: "2261", schedules: [] });

function makeSchedule(courseCode: string): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode: testCourseCode(courseCode),
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
    testStore.setState({ calendarMode: null });
    testStore.setState({
      ...testStore.getState(),
      basketCourses: [],
      constrainedPerRequirement: {},
      selectedPerRequirement: {},
      currentSchedule: null,
      cache,
    });
  });

  it("pins and unpins a course in basic mode", () => {
    testStore.setState({ calendarMode: "basic" });
    testStore.setState({
      additionalElectivesCount: 3,
      currentSchedule: makeSchedule("CSI 2132"),
    });

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().basketCourses).toEqual(["CSI 2132"]);
    expect(testStore.getState().additionalElectivesCount).toBe(2);

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().basketCourses).toEqual(["CSI 2132"]);
    expect(testStore.getState().additionalElectivesCount).toBe(2);

    testStore.getState().unlockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().basketCourses).toEqual([]);
    expect(testStore.getState().additionalElectivesCount).toBe(3);
  });

  it("pins and unpins across constrained requirements in advanced mode", () => {
    testStore.setState({ calendarMode: "advanced" });
    testStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      currentPoolMap: { "CSI 2132": "req-elective" },
    });

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().constrainedPerRequirement).toEqual({
      "req-elective": ["CSI 2132"],
    });

    testStore.getState().unlockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().constrainedPerRequirement).toEqual({});
  });

  it("does not duplicate when already in constrainedPerRequirement", () => {
    testStore.setState({ calendarMode: "advanced" });
    testStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      constrainedPerRequirement: { "req-elective": ["CSI 2132"] },
    });

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().constrainedPerRequirement).toEqual({
      "req-elective": ["CSI 2132"],
    });
  });

  it("does not add to constrain when already in selectedPerRequirement for that requirement", () => {
    testStore.setState({ calendarMode: "advanced" });
    testStore.setState({
      currentSchedule: makeSchedule("CSI 2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      selectedPerRequirement: { "req-elective": ["CSI 2132"] },
    });

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    expect(testStore.getState().constrainedPerRequirement).toEqual({});
  });

  it("locks to the most restrictive requirement when multiple requirements match", () => {
    testStore.setState({ calendarMode: "advanced" });
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
    testStore.setState({
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

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    const state = testStore.getState().constrainedPerRequirement;
    expect(state["req-specific"]).toEqual(["CSI 2132"]);
    expect(state["req-free"]).toBeUndefined();
  });

  it("does not append a second alias for the same normalized course", () => {
    testStore.setState({ calendarMode: "advanced" });
    testStore.setState({
      currentSchedule: makeSchedule("CSI2132"),
      requirementTreeWithStatus: electiveTree,
      remainingRequirements: [makeRemainingReq("req-elective", ["CSI 2132", "MAT 1341"])],
      constrainedPerRequirement: { "req-elective": ["CSI2132"] },
      currentPoolMap: { CSI2132: "req-elective" },
    });

    testStore.getState().lockCourseForAllSchedulesFromSwap(0);
    const codes = testStore.getState().constrainedPerRequirement["req-elective"] ?? [];
    expect(codes).toHaveLength(1);
    expect(normalizeCourseCode(codes[0])).toBe(normalizeCourseCode("CSI 2132"));
  });
});
