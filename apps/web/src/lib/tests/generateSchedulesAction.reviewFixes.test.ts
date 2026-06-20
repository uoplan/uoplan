import { describe, expect, it } from "vitest";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";
import type { Catalogue, ScheduleEngine, SchedulesData } from "@uoplan/core";
import { buildDataCache } from "@uoplan/core";
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
    basicElectivesCount: 1,
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
    generationMinProfessorRating: null,
    professorRatings: null,
    currentSeed: 1,
    firstSeed: 1,
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    generationLimitFirstYearCredits: true,
    generationCompressedSchedule: false,
    generationPreferEasier: false,
    generationPreferHigherSentiment: false,
    courseSentimentByNorm: null,
    frenchImmersionStream: false,
    blacklistedCourses: [],
    blockedTimes: [],
    ...overrides,
  };
}

describe("generateSchedulesAction review fixes", () => {
  it("counts group-token constrained picks toward the advanced engine target", async () => {
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
        coursesThisSemester: 0,
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.coursesThisSemester).toBe(2);
  });

  it("clamps stale basic additional electives before sending the engine request", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        mode: "basic",
        basketCourses: ["CSI 2110", "CSI 2120"],
        basicElectivesCount: SCHEDULE_COURSE_COUNT_MAX,
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.basicElectivesCount).toBe(SCHEDULE_COURSE_COUNT_MAX - 2);
  });

  it("normalizes legacy hard professor-rating values to the lenient basic toggle value", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        mode: "basic",
        generationMinProfessorRating: 4.5,
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.constraints?.minProfessorRating).toBe(2);
  });

  it("normalizes legacy hard professor-rating values to the lenient advanced toggle value", async () => {
    const engine = new RecordingEngine();

    await generateSchedulesAction(
      baseInput({
        generationMinProfessorRating: 4.5,
      }),
      cache,
      engine,
    );

    expect(engine.requests[0]?.constraints?.minProfessorRating).toBe(2);
  });
});
