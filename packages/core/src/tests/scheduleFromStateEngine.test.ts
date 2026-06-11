import { describe, it, expect } from "vitest";
import { generateScheduleFromDecodedState } from "../scheduleFromStateEngine";
import type { ScheduleEngine } from "../engineBridge";
import { GenerationRequest, GenerationResponse, Mode } from "@uoplan/proto/engine";
import type { GenerationResponse as GenerationResponseType } from "@uoplan/proto/engine";
import type { DataCache } from "../dataCache";
import type { CourseSchedule, ComponentSection, DayOfWeekCode } from "../dataTypes";
import type { DecodedState } from "../stateEncode";
import type { GenerationConstraints } from "../generation/types";
import type { NormalizedCourseCode } from "../brand";
import { buildDataCache } from "../dataCache";
import type { Catalogue, Program, SchedulesData } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

function resp(over: Partial<GenerationResponseType>): GenerationResponseType {
  return {
    hasSchedule: false,
    courses: [],
    optionalPool: [],
    pinned: [],
    chosenCourseToRequirement: {},
    poolDiagnostics: undefined,
    error: undefined,
    ...over,
  };
}

function section(part: Partial<ComponentSection> & { section: string }): ComponentSection {
  return { sectionCode: null, component: null, session: null, times: [], status: null, ...part };
}

function schedule(code: string, components: Record<string, ComponentSection[]>): CourseSchedule {
  return {
    subject: code.split(" ")[0],
    catalogNumber: code.split(" ")[1] ?? "1000",
    courseCode: code as NormalizedCourseCode,
    title: code,
    timeZone: "America/Toronto",
    components,
  };
}

function lec(code: string, day: DayOfWeekCode, start: number, end: number): CourseSchedule {
  return schedule(code, {
    LEC: [
      section({
        section: "A",
        times: [{ day, startMinutes: start, endMinutes: end, virtual: false }],
      }),
    ],
  });
}

function fakeCache(schedules: CourseSchedule[]): DataCache {
  const byCode = new Map(schedules.map((s) => [s.courseCode as string, s]));
  return {
    getAllSchedules: () => schedules,
    getSchedule: (code: string) => byCode.get(code) ?? null,
    getCourse: (code: string) => ({ code }) as never,
    resolveToCanonical: (code: string) => code as NormalizedCourseCode,
    getAllCourses: () => [],
    getCoursesByDiscipline: () => [],
  } as unknown as DataCache;
}

const constraints: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 1440,
  minProfessorRating: 0,
  maxFirstYearCredits: 24,
  professorRatings: {},
  blockedTimes: [],
};

function decoded(over: Partial<DecodedState> = {}): DecodedState {
  return {
    wizardMode: "basic",
    basicPinnedCourses: [],
    basicElectivesCount: 0,
    basicExcludedCategories: [],
    selectedTermId: null,
    firstYear: null,
    program: null,
    minorProgram: null,
    completedCourseCodes: [],
    levelBuckets: [],
    languageBuckets: [],
    electiveLevelBuckets: [],
    coursesThisSemester: 0,
    firstSeed: 1,
    currentSeed: 1,
    swaps: [],
    optionSelections: [],
    courseSelections: [],
    constrainedSelections: [],
    constrainedGroupSelections: [],
    requirementPrioritySelections: [],
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    studentPrograms: [],
    touchedReqIndices: [],
    generationMinStartMinutes: 0,
    generationMaxEndMinutes: 1440,
    generationMinProfessorRating: null,
    generationLimitFirstYearCredits: false,
    generationCompressedSchedule: false,
    generationPreferEasier: false,
    generationPreferHigherSentiment: false,
    activeStep: 0,
    showCalendar: false,
    frenchImmersionStream: false,
    calendarWeekIndex: null,
    blacklistedCourses: [],
    blockedTimes: [],
    ...over,
  };
}

/** Engine that always returns the given course/component selections as a schedule. */
function engineReturning(
  courses: Array<{ courseCode: string; components: Array<{ component: string; section: string }> }>,
): ScheduleEngine {
  return {
    generate: () =>
      GenerationResponse.encode(resp({ hasSchedule: courses.length > 0, courses })).finish(),
    timetable_fixed_set: () => new Uint8Array(),
  };
}

describe("generateScheduleFromDecodedState — mode selection", () => {
  it("returns null in advanced mode when no program is selected", () => {
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
    ]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ wizardMode: "advanced", program: null }),
      fakeCache([lec("CSI 2110", "Mo", 540, 600)]),
      constraints,
    );
    expect(result).toBeNull();
  });

  it("sends a MODE_BASIC request in basic mode", () => {
    let mode: Mode | null = null;
    const engine: ScheduleEngine = {
      generate: (bytes) => {
        mode = GenerationRequest.decode(bytes).mode;
        return GenerationResponse.encode(resp({ hasSchedule: false })).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    };
    generateScheduleFromDecodedState(
      engine,
      decoded({ wizardMode: "basic" }),
      fakeCache([]),
      constraints,
    );
    expect(mode).toBe(Mode.MODE_BASIC);
  });
});

describe("generateScheduleFromDecodedState — reconstruction + colour map", () => {
  it("rebuilds the engine schedule and assigns a stable colour map", () => {
    const cache = fakeCache([lec("CSI 2110", "Mo", 540, 600), lec("MAT 1320", "Tu", 540, 600)]);
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
      { courseCode: "MAT 1320", components: [{ component: "LEC", section: "A" }] },
    ]);
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
  it("applies a feasible swap and transfers the colour to the new course", () => {
    const cache = fakeCache([
      lec("CSI 2110", "Mo", 540, 600),
      lec("MAT 1320", "Tu", 540, 600),
      lec("CSI 3120", "We", 540, 600), // does not overlap MAT 1320
    ]);
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
      { courseCode: "MAT 1320", components: [{ component: "LEC", section: "A" }] },
    ]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ swaps: [{ enrollmentIndex: 0, courseCode: "CSI 3120" }] }),
      cache,
      constraints,
    );
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 3120", "MAT 1320"]);
    // old course's colour index (0) is transferred to CSI 3120; CSI 2110 dropped
    expect(result!.colorMap).toEqual({ "MAT 1320": 1, "CSI 3120": 0 });
  });

  it("skips a swap whose only section overlaps the rest of the schedule", () => {
    const cache = fakeCache([
      lec("CSI 2110", "Mo", 540, 600),
      lec("MAT 1320", "Tu", 540, 600),
      lec("CSI 3120", "Tu", 540, 600), // overlaps MAT 1320
    ]);
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
      { courseCode: "MAT 1320", components: [{ component: "LEC", section: "A" }] },
    ]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ swaps: [{ enrollmentIndex: 0, courseCode: "CSI 3120" }] }),
      cache,
      constraints,
    );
    // schedule and colours unchanged
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 2110", "MAT 1320"]);
    expect(result!.colorMap).toEqual({ "CSI 2110": 0, "MAT 1320": 1 });
  });

  it("skips a swap referencing an out-of-range enrollment index", () => {
    const cache = fakeCache([lec("CSI 2110", "Mo", 540, 600), lec("CSI 3120", "We", 540, 600)]);
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
    ]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ swaps: [{ enrollmentIndex: 5, courseCode: "CSI 3120" }] }),
      cache,
      constraints,
    );
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 2110"]);
    expect(result!.colorMap).toEqual({ "CSI 2110": 0 });
  });

  it("skips a swap when the new course has no schedule data", () => {
    const cache = fakeCache([lec("CSI 2110", "Mo", 540, 600)]);
    const engine = engineReturning([
      { courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] },
    ]);
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ swaps: [{ enrollmentIndex: 0, courseCode: "ZZZ 9999" }] }),
      cache,
      constraints,
    );
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 2110"]);
    expect(result!.colorMap).toEqual({ "CSI 2110": 0 });
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
    let mode: Mode | null = null;
    const engine: ScheduleEngine = {
      generate: (bytes) => {
        mode = GenerationRequest.decode(bytes).mode;
        return GenerationResponse.encode(
          resp({
            hasSchedule: true,
            courses: [{ courseCode: "CSI 1000", components: [{ component: "LEC", section: "A" }] }],
          }),
        ).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    };
    const result = generateScheduleFromDecodedState(
      engine,
      decoded({ wizardMode: "advanced", program, coursesThisSemester: 1 }),
      cache,
      constraints,
    );
    expect(mode).toBe(Mode.MODE_ADVANCED);
    expect(result).not.toBeNull();
    expect(result!.schedule.enrollments.map((e) => e.courseCode)).toEqual(["CSI 1000"]);
    expect(result!.colorMap).toEqual({ "CSI 1000": 0 });
  });
});
