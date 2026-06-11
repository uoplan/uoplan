import { describe, it, expect } from "vitest";
import {
  buildBasicRequest,
  buildAdvancedRequest,
  mapGenerationResponse,
  runBasicGeneration,
  runAdvancedGeneration,
  runTimetableFixedSet,
  EngineMode,
  type BasicRequestInput,
  type AdvancedRequestInput,
  type ScheduleEngine,
} from "../engineBridge";
import {
  GenerationRequest,
  GenerationResponse,
  TimetableRequest,
  Mode,
} from "@uoplan/proto/engine";
import type { DataCache } from "../dataCache";
import type { CourseSchedule, ComponentSection } from "../dataTypes";
import type { GenerationConstraints } from "../generation/types";
import type { NormalizedCourseCode } from "../brand";
import type { GenerationResponse as GenerationResponseType } from "@uoplan/proto/engine";

/** Build a complete GenerationResponse (the generated protos only expose encode/decode). */
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
  return {
    sectionCode: null,
    component: null,
    session: null,
    times: [],
    status: null,
    ...part,
  };
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

/** Minimal DataCache double supporting only the methods engineBridge touches. */
function fakeCache(schedules: CourseSchedule[]): DataCache {
  const byCode = new Map(schedules.map((s) => [s.courseCode as string, s]));
  return {
    getAllSchedules: () => schedules,
    getSchedule: (code: string) => byCode.get(code) ?? null,
    resolveToCanonical: (code: string) => code as NormalizedCourseCode,
  } as unknown as DataCache;
}

const baseConstraints: GenerationConstraints = {
  minStartMinutes: 480,
  maxEndMinutes: 1200,
  minProfessorRating: 3,
  maxFirstYearCredits: 24,
  professorRatings: {
    "Jane Doe": { rating: 4.5, numRatings: 10 },
    Unrated: { rating: 0, numRatings: 0 },
  },
  blockedTimes: [{ day: "We", startMinutes: 600, endMinutes: 660 }],
};

function basicInput(over: Partial<BasicRequestInput> = {}): BasicRequestInput {
  return {
    constraints: baseConstraints,
    completedCourses: ["CSI 1000"],
    levelBuckets: ["1000"],
    languageBuckets: ["en"],
    electiveLevelBuckets: [1000, 2000],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    generationPreferEasier: false,
    generationPreferHigherSentiment: false,
    courseSentimentByNorm: null,
    blacklistedCourses: ["MAT 9999"],
    currentSeed: 7,
    firstSeed: 1,
    basicPinnedCourses: ["CSI 2110"],
    basicElectivesCount: 2,
    basicExcludedCategories: ["seminar"],
    studentPrograms: ["CS"],
    frenchImmersionStream: false,
    ...over,
  };
}

function advancedInput(over: Partial<AdvancedRequestInput> = {}): AdvancedRequestInput {
  return {
    constraints: baseConstraints,
    completedCourses: ["CSI 1000"],
    levelBuckets: [],
    languageBuckets: [],
    electiveLevelBuckets: [],
    includeClosedComponents: true,
    virtualSectionsOnly: true,
    generationPreferEasier: false,
    generationPreferHigherSentiment: false,
    courseSentimentByNorm: null,
    blacklistedCourses: [],
    currentSeed: 3,
    firstSeed: 3,
    prereqEligibleCourses: ["CSI 2110"],
    remainingRequirements: [
      {
        requirementId: "r1",
        type: "course",
        title: "Intro",
        candidateCourses: ["CSI 1100"],
        creditsNeeded: 3,
        pickedCount: 0,
        satisfiedBy: [],
      },
    ],
    requirementTreeWithStatus: [
      {
        type: "or",
        title: "Choose one",
        complete: false,
        satisfiedBy: [],
        candidateCourses: ["CSI 1100"],
        options: [{ type: "course", code: "CSI 1100", complete: false, satisfiedBy: [] }],
      },
    ],
    constrainedPerRequirementRaw: { r1: ["CSI 1100"] },
    selectedPerRequirement: { r1: ["CSI 1100"] },
    selectedOptionsPerRequirement: { r1: 0 },
    coursesThisSemester: 5,
    forcedCourses: ["CSI 1100"],
    frenchImmersionStream: true,
    basicExcludedCategories: [],
    ...over,
  };
}

describe("buildBasicRequest", () => {
  it("produces a MODE_BASIC request with basic fields populated and advanced fields empty", () => {
    const req = buildBasicRequest(basicInput(), fakeCache([]));
    expect(req.mode).toBe(Mode.MODE_BASIC);
    expect(EngineMode).toBe(Mode);
    expect(req.basicPinnedCourses).toEqual(["CSI 2110"]);
    expect(req.basicElectivesCount).toBe(2);
    expect(req.studentPrograms).toEqual(["CS"]);
    // advanced-only fields are zeroed out
    expect(req.remainingRequirements).toEqual([]);
    expect(req.requirementTree).toEqual([]);
    expect(req.selectedPerRequirement).toEqual({});
    expect(req.coursesThisSemester).toBe(0);
    expect(req.forcedCourses).toEqual([]);
  });

  it("maps constraints, day codes, and filters non-finite professor ratings", () => {
    const req = buildBasicRequest(basicInput(), fakeCache([]));
    expect(req.constraints?.minStartMinutes).toBe(480);
    expect(req.constraints?.compressedSchedule).toBe(false);
    // "We" -> index 2
    expect(req.constraints?.blockedTimes).toEqual([{ day: 2, startMinutes: 600, endMinutes: 660 }]);
    // unrated professors (numRatings 0) are dropped; only real ratings forwarded
    expect(req.professorRatings).toEqual({ "Jane Doe": 4.5 });
  });

  it("only computes the courseAplus map when 'prefer easier' is enabled", () => {
    const sched = schedule("CSI 2110", {
      LEC: [section({ section: "A", distribution: { "A+": 50, B: 50 } })],
    });
    const cache = fakeCache([sched]);
    expect(
      buildBasicRequest(basicInput({ generationPreferEasier: false }), cache).courseAplus,
    ).toEqual({});
    const on = buildBasicRequest(basicInput({ generationPreferEasier: true }), cache);
    expect(on.courseAplus["CSI 2110"]).toBeCloseTo(50);
  });

  it("only computes courseSentiment when enabled and a sentiment map is supplied", () => {
    const sched = schedule("CSI 2110", { LEC: [section({ section: "A" })] });
    const cache = fakeCache([sched]);
    const byNorm = new Map<NormalizedCourseCode, number>([
      ["CSI 2110" as NormalizedCourseCode, 4.2],
    ]);
    expect(
      buildBasicRequest(
        basicInput({ generationPreferHigherSentiment: false, courseSentimentByNorm: byNorm }),
        cache,
      ).courseSentiment,
    ).toEqual({});
    const on = buildBasicRequest(
      basicInput({ generationPreferHigherSentiment: true, courseSentimentByNorm: byNorm }),
      cache,
    );
    expect(on.courseSentiment["CSI 2110"]).toBeCloseTo(4.2);
  });
});

describe("buildAdvancedRequest", () => {
  it("produces a MODE_ADVANCED request and maps requirement structures", () => {
    const req = buildAdvancedRequest(advancedInput(), fakeCache([]));
    expect(req.mode).toBe(Mode.MODE_ADVANCED);
    // basic-only fields zeroed
    expect(req.basicPinnedCourses).toEqual([]);
    expect(req.basicElectivesCount).toBe(0);
    expect(req.studentPrograms).toEqual([]);
    // remaining requirements mapped through
    expect(req.remainingRequirements).toHaveLength(1);
    expect(req.remainingRequirements[0]).toMatchObject({
      requirementId: "r1",
      candidateCourses: ["CSI 1100"],
      creditsNeeded: 3,
    });
    // record<string,string[]> wrapped into StringList
    expect(req.selectedPerRequirement.r1).toEqual({ values: ["CSI 1100"] });
    expect(req.constrainedPerRequirement.r1).toEqual({ values: ["CSI 1100"] });
    expect(req.coursesThisSemester).toBe(5);
    expect(req.forcedCourses).toEqual(["CSI 1100"]);
    expect(req.frenchImmersionStream).toBe(true);
  });

  it("recursively maps the requirement tree options and aliases excluded_disciplines", () => {
    const input = advancedInput();
    input.requirementTreeWithStatus[0].excluded_disciplines = ["PHI"];
    const req = buildAdvancedRequest(input, fakeCache([]));
    const node = req.requirementTree[0];
    expect(node.type).toBe("or");
    expect(node.excludedDisciplines).toEqual(["PHI"]);
    expect(node.options).toHaveLength(1);
    expect(node.options[0].code).toBe("CSI 1100");
  });
});

describe("mapGenerationResponse", () => {
  const sched = schedule("CSI 2110", {
    LEC: [
      section({
        section: "A",
        times: [{ day: "Mo", startMinutes: 540, endMinutes: 600, virtual: false }],
      }),
    ],
  });

  it("returns a null schedule when the response has no schedule", () => {
    const result = mapGenerationResponse(resp({ hasSchedule: false }), fakeCache([sched]));
    expect(result.schedule).toBeNull();
  });

  it("rebuilds enrollments from chosen course/component sections", () => {
    const response = resp({
      hasSchedule: true,
      courses: [{ courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] }],
      pinned: ["CSI 2110"],
      optionalPool: ["MAT 1320"],
      chosenCourseToRequirement: { "CSI 2110": "r1" },
    });
    const result = mapGenerationResponse(response, fakeCache([sched]));
    expect(result.schedule?.enrollments).toHaveLength(1);
    const enr = result.schedule!.enrollments[0];
    expect(enr.courseCode).toBe("CSI 2110");
    expect(enr.sectionCombo.LEC.section.section).toBe("A");
    expect(enr.times).toEqual([
      { day: "Mo", startMinutes: 540, endMinutes: 600, meetingDates: null },
    ]);
    expect(result.pinned).toEqual(["CSI 2110"]);
    expect(result.optionalPool).toEqual(["MAT 1320"]);
    expect(result.chosenCourseToRequirementId).toEqual({ "CSI 2110": "r1" });
  });

  it("yields a null schedule when a chosen section cannot be resolved", () => {
    const response = resp({
      hasSchedule: true,
      courses: [{ courseCode: "CSI 2110", components: [{ component: "LEC", section: "ZZ" }] }],
    });
    const result = mapGenerationResponse(response, fakeCache([sched]));
    expect(result.schedule).toBeNull();
  });

  it("treats a component-less course as a timeless (honours-project) enrollment", () => {
    const response = resp({
      hasSchedule: true,
      courses: [{ courseCode: "CSI 4900", components: [] }],
    });
    const result = mapGenerationResponse(response, fakeCache([sched]));
    expect(result.schedule?.enrollments[0]).toMatchObject({
      courseCode: "CSI 4900",
      sectionCombo: {},
      times: [],
    });
  });

  it("maps pool diagnostics and error passthrough", () => {
    const response = resp({
      hasSchedule: false,
      poolDiagnostics: {
        emptyPools: [{ label: "Electives", requirementId: "e1", candidateCourses: ["X 1000"] }],
        totalAvailable: 1,
        totalNeeded: 3,
      },
      error: "infeasible",
    });
    const result = mapGenerationResponse(response, fakeCache([]));
    expect(result.poolDiagnostics).toEqual({
      emptyPools: [{ label: "Electives", requirementId: "e1", candidateCourses: ["X 1000"] }],
      totalAvailable: 1,
      totalNeeded: 3,
    });
    expect(result.error).toBe("infeasible");
  });
});

describe("engine runners (encode → engine → decode)", () => {
  const sched = schedule("CSI 2110", { LEC: [section({ section: "A" })] });

  it("runBasicGeneration encodes a valid request and maps the decoded response", () => {
    let received: GenerationRequest | null = null;
    const engine: ScheduleEngine = {
      generate: (bytes) => {
        received = GenerationRequest.decode(bytes);
        return GenerationResponse.encode(
          resp({
            hasSchedule: true,
            courses: [{ courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] }],
          }),
        ).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    };
    const result = runBasicGeneration(engine, basicInput(), fakeCache([sched]));
    expect(received!.mode).toBe(Mode.MODE_BASIC);
    expect(result.schedule?.enrollments[0].courseCode).toBe("CSI 2110");
  });

  it("runAdvancedGeneration sends a MODE_ADVANCED request", () => {
    let mode: Mode | null = null;
    const engine: ScheduleEngine = {
      generate: (bytes) => {
        mode = GenerationRequest.decode(bytes).mode;
        return GenerationResponse.encode(resp({ hasSchedule: false })).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    };
    runAdvancedGeneration(engine, advancedInput(), fakeCache([]));
    expect(mode).toBe(Mode.MODE_ADVANCED);
  });

  it("runTimetableFixedSet forwards a TimetableRequest with an unsigned seed", () => {
    let received: TimetableRequest | null = null;
    const engine: ScheduleEngine = {
      generate: () => new Uint8Array(),
      timetable_fixed_set: (bytes) => {
        received = TimetableRequest.decode(bytes);
        return GenerationResponse.encode(
          resp({
            hasSchedule: true,
            courses: [{ courseCode: "CSI 2110", components: [{ component: "LEC", section: "A" }] }],
          }),
        ).finish();
      },
    };
    const result = runTimetableFixedSet(
      engine,
      {
        courseCodes: ["CSI 2110"],
        constraints: baseConstraints,
        seed: -1, // becomes unsigned 0xffffffff
        includeClosedComponents: false,
        virtualSectionsOnly: false,
      },
      fakeCache([sched]),
    );
    expect(received!.courseCodes).toEqual(["CSI 2110"]);
    expect(received!.seed).toBe(0xffffffff);
    expect(result?.enrollments[0].courseCode).toBe("CSI 2110");
  });
});
