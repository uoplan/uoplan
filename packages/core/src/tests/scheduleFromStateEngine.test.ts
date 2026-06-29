import { describe, expect, it } from "vitest";
import { generateScheduleFromDecodedState } from "../scheduleFromStateEngine";
import { buildDataCache } from "../dataCache";
import type { Catalogue, Program, SchedulesData } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";
import {
  testGenerationConstraints as constraints,
  decodedState as decoded,
  engineCapturingRequest,
  engineReturning,
  fakeDataCache as fakeCache,
  testLectureSchedule as lec,
} from "./engineTestHelpers";

function generatedCourse(courseCode: string): {
  courseCode: string;
  components: Array<{ component: string; section: string }>;
} {
  return { courseCode, components: [{ component: "LEC", section: "A" }] };
}

function engineReturningCourses(courseCodes: string[]) {
  return engineReturning(courseCodes.map(generatedCourse));
}

function lectureCache(
  specs: Array<
    readonly [code: string, day: Parameters<typeof lec>[1], start?: number, end?: number]
  >,
) {
  return fakeCache(specs.map(([code, day, start = 540, end = 600]) => lec(code, day, start, end)));
}

describe("generateScheduleFromDecodedState — mode selection", () => {
  it("returns null in advanced mode when no program is selected", () => {
    const engine = engineReturningCourses(["CSI 2110"]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ wizardMode: "advanced", program: null }),
      fakeCache([lec("CSI 2110", "Mo", 540, 600)]),
      constraints,
    );
    expect(result).toBeNull();
  });

  it("forwards basket inputs to the engine in basic mode", () => {
    const { engine, getRequest } = engineCapturingRequest();
    generateScheduleFromDecodedState(
      engine,
      decoded({
        wizardMode: "basic",
        additionalElectivesCount: 3,
        basketCourses: [normalizeCourseCode("CSI 2110")],
      }),
      fakeCache([]),
      constraints,
    );
    expect(getRequest()!.additionalElectivesCount).toBe(3);
    expect(getRequest()!.basicPinnedCourses).toEqual(["CSI 2110"]);
  });
});

describe("generateScheduleFromDecodedState — reconstruction + colour map", () => {
  it("rebuilds the engine schedule and assigns a stable colour map", () => {
    const cache = lectureCache([
      ["CSI 2110", "Mo"],
      ["MAT 1320", "Tu"],
    ]);
    const engine = engineReturningCourses(["CSI 2110", "MAT 1320"]);
    const result = generateScheduleFromDecodedState(engine, decoded(), cache, constraints);
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 2110", "MAT 1320"]);
    // colours assigned by sorted course code
    expect(result!.colorMap).toEqual({ "CSI 2110": 0, "MAT 1320": 1 });
  });

  it("returns null when the engine produces no schedule", () => {
    const result = generateScheduleFromDecodedState(
      engineReturning([]),
      decoded(),
      fakeCache([]),
      constraints,
    );
    expect(result).toBeNull();
  });
});

describe("generateScheduleFromDecodedState — swap replay", () => {
  it.each([
    {
      name: "applies a feasible swap and transfers the colour to the new course",
      // CSI 3120 (We) does not overlap MAT 1320 (Tu)
      cache: [
        ["CSI 2110", "Mo"],
        ["MAT 1320", "Tu"],
        ["CSI 3120", "We"],
      ] as [string, Parameters<typeof lec>[1]][],
      engineCourses: ["CSI 2110", "MAT 1320"],
      swaps: [{ enrollmentIndex: 0, courseCode: "CSI 3120" }],
      // old course's colour index (0) is transferred to CSI 3120; CSI 2110 dropped
      expectedCourses: ["CSI 3120", "MAT 1320"],
      expectedColorMap: { "MAT 1320": 1, "CSI 3120": 0 },
    },
    {
      name: "skips a swap whose only section overlaps the rest of the schedule",
      // CSI 3120 (Tu) overlaps MAT 1320 (Tu)
      cache: [
        ["CSI 2110", "Mo"],
        ["MAT 1320", "Tu"],
        ["CSI 3120", "Tu"],
      ] as [string, Parameters<typeof lec>[1]][],
      engineCourses: ["CSI 2110", "MAT 1320"],
      swaps: [{ enrollmentIndex: 0, courseCode: "CSI 3120" }],
      // schedule and colours unchanged
      expectedCourses: ["CSI 2110", "MAT 1320"],
      expectedColorMap: { "CSI 2110": 0, "MAT 1320": 1 },
    },
    {
      name: "skips a swap referencing an out-of-range enrollment index",
      cache: [
        ["CSI 2110", "Mo"],
        ["CSI 3120", "We"],
      ] as [string, Parameters<typeof lec>[1]][],
      engineCourses: ["CSI 2110"],
      swaps: [{ enrollmentIndex: 5, courseCode: "CSI 3120" }],
      expectedCourses: ["CSI 2110"],
      expectedColorMap: { "CSI 2110": 0 },
    },
    {
      name: "skips a swap when the new course has no schedule data",
      cache: [["CSI 2110", "Mo"]] as [string, Parameters<typeof lec>[1]][],
      engineCourses: ["CSI 2110"],
      swaps: [{ enrollmentIndex: 0, courseCode: "ZZZ 9999" }],
      expectedCourses: ["CSI 2110"],
      expectedColorMap: { "CSI 2110": 0 },
    },
  ])("$name", ({ cache, engineCourses, swaps, expectedCourses, expectedColorMap }) => {
    const result = generateScheduleFromDecodedState(
      engineReturningCourses(engineCourses),
      decoded({ swaps }),
      lectureCache(cache),
      constraints,
    );
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(expectedCourses);
    expect(result!.colorMap).toEqual(expectedColorMap);
  });
});

describe("generateScheduleFromDecodedState — advanced mode with a real program", () => {
  const catalogue: Catalogue = {
    courses: [
      {
        code: normalizeCourseCode("CSI 1000"),
        title: "Intro",
        credits: 3,
        description: "",
        component: "LEC",
      },
    ],
    programs: [],
  };
  const schedulesData: SchedulesData = {
    termId: "2261",
    schedules: [lec("CSI 1000", "Mo", 540, 600)],
  };
  const program: Program = {
    title: "Test Program",
    url: "",
    requirements: [{ type: "course", code: normalizeCourseCode("CSI 1000"), credits: 3 }],
  };

  it("builds an advanced request and reconstructs the engine's schedule", () => {
    const cache = buildDataCache(catalogue, schedulesData);
    const { engine, getRequest } = engineCapturingRequest({
      hasSchedule: true,
      courses: [generatedCourse("CSI 1000")],
    });
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ wizardMode: "advanced", program, coursesThisSemester: 1 }),
      cache,
      constraints,
    );
    expect(getRequest()!.remainingRequirements.length).toBeGreaterThan(0);
    expect(getRequest()!.additionalElectivesCount).toBe(0);
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 1000"]);
    expect(result!.colorMap).toEqual({ "CSI 1000": 0 });
  });
});
