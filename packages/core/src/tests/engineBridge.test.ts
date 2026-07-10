import { describe, expect, it } from "vitest";
import {
  buildAdvancedRequest,
  buildBasicRequest,
  mapGenerationResponse,
  runAdvancedGeneration,
  runBasicGeneration,
  runTimetableFixedSet,
} from "../engineBridge";
import type { AdvancedRequestInput, BasicRequestInput, ScheduleEngine } from "../engineBridge";
import { GenerationRequest, GenerationResponse, TimetableRequest } from "@uoplan/proto/engine";
import type { GenerationConstraints } from "../generation/types";
import type { NormalizedCourseCode } from "../brand";
import type { OptimizationKind } from "../optimizationPriorities";
import {
  defaultOptimizationPriorities,
  setOptimizationPriorityEnabled,
} from "../optimizationPriorities";
import {
  fakeDataCache as fakeCache,
  generationResponse as resp,
  testCourseSchedule as schedule,
  testSection as section,
} from "@uoplan/generation/tests/engineTestHelpers";

/** Default priority list with a single objective's enabled flag overridden. */
function prioritiesWith(kind: OptimizationKind, enabled: boolean) {
  return setOptimizationPriorityEnabled(defaultOptimizationPriorities(), kind, enabled);
}

const baseConstraints: GenerationConstraints = {
  minStartMinutes: 480,
  maxEndMinutes: 1200,
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
    optimizationPriorities: defaultOptimizationPriorities(),
    courseSentimentByNorm: null,
    blacklistedCourses: ["MAT 9999"],
    currentSeed: 7,
    firstSeed: 1,
    basketCourses: ["CSI 2110"],
    coursesThisSemester: 5,
    additionalElectivesCount: 2,
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
    optimizationPriorities: defaultOptimizationPriorities(),
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
    additionalElectivesCount: 2,
    forcedCourses: ["CSI 1100"],
    frenchImmersionStream: true,
    basicExcludedCategories: [],
    ...over,
  };
}

describe("buildBasicRequest", () => {
  it("produces a basket request with basic fields populated and advanced fields empty", () => {
    const req = buildBasicRequest(basicInput(), fakeCache([]));
    expect(req.basicPinnedCourses).toEqual(["CSI 2110"]);
    expect(req.additionalElectivesCount).toBe(2);
    expect(req.studentPrograms).toEqual(["CS"]);
    // advanced-only fields are zeroed out
    expect(req.remainingRequirements).toEqual([]);
    expect(req.requirementTree).toEqual([]);
    expect(req.selectedPerRequirement).toEqual({});
    expect(req.coursesThisSemester).toBe(5);
    expect(req.forcedCourses).toEqual([]);
  });

  it("maps constraints, day codes, and forwards professor ratings when the preference is on", () => {
    const req = buildBasicRequest(basicInput(), fakeCache([]));
    expect(req.constraints?.minStartMinutes).toBe(480);
    // "We" -> index 2
    expect(req.constraints?.blockedTimes).toEqual([{ day: 2, startMinutes: 600, endMinutes: 660 }]);
    // prefer-higher-professor-rating objective is enabled by default: unrated professors
    // (numRatings 0) are dropped; only real ratings forwarded.
    expect(req.professorRatings).toEqual({ "Jane Doe": 4.5 });
  });

  it("omits professor ratings when the prefer-higher-rating preference is off", () => {
    const req = buildBasicRequest(
      basicInput({
        optimizationPriorities: prioritiesWith("prefer_professor_rating", false),
      }),
      fakeCache([]),
    );
    expect(req.professorRatings).toEqual({});
  });

  it("only computes the courseAplus map when 'prefer easier' is enabled", () => {
    const sched = schedule("CSI 2110", {
      LEC: [section({ section: "A", distribution: { "A+": 50, B: 50 } })],
    });
    const cache = fakeCache([sched]);
    expect(
      buildBasicRequest(
        basicInput({ optimizationPriorities: prioritiesWith("prefer_easier", false) }),
        cache,
      ).courseAplus,
    ).toEqual({});
    const on = buildBasicRequest(
      basicInput({ optimizationPriorities: prioritiesWith("prefer_easier", true) }),
      cache,
    );
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
        basicInput({
          optimizationPriorities: prioritiesWith("prefer_sentiment", false),
          courseSentimentByNorm: byNorm,
        }),
        cache,
      ).courseSentiment,
    ).toEqual({});
    const on = buildBasicRequest(
      basicInput({
        optimizationPriorities: prioritiesWith("prefer_sentiment", true),
        courseSentimentByNorm: byNorm,
      }),
      cache,
    );
    expect(on.courseSentiment["CSI 2110"]).toBeCloseTo(4.2);
  });
});

describe("buildAdvancedRequest", () => {
  it("produces an advanced request and maps requirement structures", () => {
    const req = buildAdvancedRequest(advancedInput(), fakeCache([]));
    // basic-pinned is empty in advanced mode; M (additional electives) is now
    // forwarded in both modes.
    expect(req.basicPinnedCourses).toEqual([]);
    expect(req.additionalElectivesCount).toBe(2);
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
    expect(received!.basicPinnedCourses).toEqual(["CSI 2110"]);
    expect(received!.additionalElectivesCount).toBe(2);
    expect(result.schedule?.enrollments[0].courseCode).toBe("CSI 2110");
  });

  it("runAdvancedGeneration sends an advanced request with empty basket fields", () => {
    let received: GenerationRequest | null = null;
    const engine: ScheduleEngine = {
      generate: (bytes) => {
        received = GenerationRequest.decode(bytes);
        return GenerationResponse.encode(resp({ hasSchedule: false })).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    };
    runAdvancedGeneration(engine, advancedInput(), fakeCache([]));
    expect(received!.basicPinnedCourses).toEqual([]);
    expect(received!.additionalElectivesCount).toBe(2);
    expect(received!.remainingRequirements).toHaveLength(1);
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
        optimizationPriorities: defaultOptimizationPriorities(),
      },
      fakeCache([sched]),
    );
    expect(received!.courseCodes).toEqual(["CSI 2110"]);
    expect(received!.seed).toBe(0xffffffff);
    expect(result?.enrollments[0].courseCode).toBe("CSI 2110");
  });
});
