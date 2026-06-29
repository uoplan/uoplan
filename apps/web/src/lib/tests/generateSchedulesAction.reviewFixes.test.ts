import { describe, expect, it } from "vitest";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";
import type { Catalogue, ScheduleEngine, SchedulesData } from "@uoplan/core";
import { buildDataCache, defaultOptimizationPriorities } from "@uoplan/core";
import { generateSchedulesAction } from "../generateSchedulesAction";
import type { GenerateSchedulesInput } from "../generateSchedulesAction";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";
import { testCourseCode } from "../../test/brands";
import { testScheduledCourse } from "../../test/courseScheduleFixtures";

class RecordingEngine implements ScheduleEngine {
  requests: GenerationRequest[] = [];

  generate(request: Uint8Array): Uint8Array {
    this.requests.push(GenerationRequest.decode(request));
    return GenerationResponse.encode({
      hasSchedule: false,
      courses: [],
      optionalPool: [],
      pinned: [],
      chosenCourseToRequirement: {},
      poolDiagnostics: undefined,
      error: undefined,
    }).finish();
  }

  timetable_fixed_set(_request: Uint8Array): Uint8Array {
    return GenerationResponse.encode({
      hasSchedule: false,
      courses: [],
      optionalPool: [],
      pinned: [],
      chosenCourseToRequirement: {},
      poolDiagnostics: undefined,
      error: undefined,
    }).finish();
  }
}

const catalogue: Catalogue = {
  courses: ["CSI 2110", "CSI 2120"].map((code) => ({
    code: testCourseCode(code),
    title: code,
    credits: 3,
    description: "",
  })),
  programs: [],
};

const schedules: SchedulesData = {
  termId: "0000",
  schedules: catalogue.courses.map((course) => testScheduledCourse(course.code)),
};

const cache = buildDataCache(catalogue, schedules);

function baseInput(overrides: Partial<GenerateSchedulesInput> = {}): GenerateSchedulesInput {
  return {
    mode: "advanced",
    basketCourses: [],
    additionalElectivesCount: 1,
    basicExcludedCategories: [],
    completedCourses: [],
    studentPrograms: [],
    program: null,
    remainingRequirements: [],
    requirementTreeWithStatus: [],
    selectedPerRequirement: {},
    selectedOptionsPerRequirement: {},
    constrainedPerRequirement: {},
    requirementPriorities: {},
    coursesThisSemester: 0,
    prereqEligibleCourses: ["CSI 2110", "CSI 2120"],
    unassignedCompletedCourses: [],
    levelBuckets: ["undergrad"],
    languageBuckets: ["en", "other"],
    electiveLevelBuckets: [],
    generationMinStartMinutes: 8 * 60 + 30,
    generationMaxEndMinutes: 22 * 60,
    professorRatings: null,
    currentSeed: 1,
    firstSeed: 1,
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    generationLimitFirstYearCredits: true,
    optimizationPriorities: defaultOptimizationPriorities(),
    courseSentimentByNorm: null,
    frenchImmersionStream: false,
    blacklistedCourses: [],
    blockedTimes: [],
    ...overrides,
  };
}

describe("generateSchedulesAction review fixes", () => {
  it("sends coursesThisSemester to the advanced engine target verbatim", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        constrainedPerRequirement: { "req-csi": ["group:CSI~a", "group:CSI~b"] },
        remainingRequirements: [
          {
            requirementId: "req-csi",
            type: "group",
            title: "CSI requirement",
            candidateCourses: ["CSI 2110", "CSI 2120"],
            creditsNeeded: 6,
            satisfiedBy: [],
          },
        ],
        coursesThisSemester: 3,
      }),
      cache,
      engine,
    );

    // N ("Courses this semester") is the engine target sent verbatim; the user's
    // constrained group-token picks no longer silently inflate it.
    expect(engine.requests[0]?.coursesThisSemester).toBe(3);
  });

  it("clamps stale basic additional electives before sending the engine request", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        mode: "basic",
        basketCourses: ["CSI 2110", "CSI 2120"],
        additionalElectivesCount: SCHEDULE_COURSE_COUNT_MAX,
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.additionalElectivesCount).toBe(SCHEDULE_COURSE_COUNT_MAX - 2);
  });

  it("forwards the professor-rating map to the basic engine request when enabled", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        mode: "basic",
        professorRatings: { "ada lovelace": { rating: 4.2, numRatings: 12 } },
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.professorRatings).toEqual({ "ada lovelace": 4.2 });
  });

  it("forwards the professor-rating map to the advanced engine request when enabled", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        professorRatings: { "ada lovelace": { rating: 4.2, numRatings: 12 } },
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.professorRatings).toEqual({ "ada lovelace": 4.2 });
  });

  it("omits the professor-rating map when the objective is disabled", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        mode: "basic",
        professorRatings: { "ada lovelace": { rating: 4.2, numRatings: 12 } },
        optimizationPriorities: defaultOptimizationPriorities().map((p) =>
          p.kind === "prefer_professor_rating" ? { ...p, enabled: false } : p,
        ),
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.professorRatings).toEqual({});
  });
});
