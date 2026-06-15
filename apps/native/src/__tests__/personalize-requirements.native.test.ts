import type { Catalogue, Program, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  buildRequirementCandidateSet,
  computePersonalizeRequirements,
} from "@/lib/personalize-requirements";

const PROGRAM_URL = "https://example.com/program";

function course(code: string, title = code) {
  return {
    code: normalizeCourseCode(code),
    title,
    credits: 3,
    description: "",
    component: "LEC",
  };
}

const program: Program = {
  title: "Test program",
  url: PROGRAM_URL,
  requirements: [
    {
      type: "and",
      title: "Compulsory courses",
      options: [
        { type: "course", code: normalizeCourseCode("CSI 2110"), credits: 3 },
        { type: "course", code: normalizeCourseCode("CSI 2120"), credits: 3 },
      ],
    },
  ],
};

const catalogue: Catalogue = {
  courses: [course("CSI 2110"), course("CSI 2120")],
  programs: [program],
};

const schedules: SchedulesData = { termId: "2261", schedules: [] };

describe("computePersonalizeRequirements", () => {
  it("returns null when no program is selected", () => {
    expect(
      computePersonalizeRequirements({
        catalogue,
        schedules,
        programUrl: null,
        completedCourses: [],
      }),
    ).toBeNull();
  });

  it("returns null when the program url is unknown", () => {
    expect(
      computePersonalizeRequirements({
        catalogue,
        schedules,
        programUrl: "https://example.com/missing",
        completedCourses: [],
      }),
    ).toBeNull();
  });

  it("reports outstanding requirements when nothing is completed", () => {
    const readout = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: [],
    });
    expect(readout).not.toBeNull();
    expect(readout!.programTitle).toBe("Test program");
    expect(readout!.remainingCount).toBeGreaterThan(0);
    expect(readout!.completed).toHaveLength(0);
  });

  it("marks requirements complete once their courses are in the basket", () => {
    const readout = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: ["CSI 2110", "CSI 2120"],
    });
    expect(readout).not.toBeNull();
    expect(readout!.remainingCount).toBe(0);
    expect(readout!.completed.length).toBeGreaterThan(0);
  });

  it("builds remaining requirement candidates excluding completed courses", () => {
    const readout = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: ["CSI 2110"],
    });

    expect(readout).not.toBeNull();
    expect([...buildRequirementCandidateSet(readout!.remaining, ["CSI 2110"])]).toEqual([
      "CSI 2120",
    ]);
  });
});
