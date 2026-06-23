import type { GenerationResponse as GenerationResponseType } from "@uoplan/proto/engine";
import type { NormalizedCourseCode } from "../brand";
import type { DataCache } from "../dataCache";
import type { Catalogue, ComponentSection, CourseSchedule, DayOfWeekCode } from "../dataTypes";
import type { GenerationConstraints } from "../generation/types";
import type { DecodedState } from "../stateEncode";
import type { ScheduleEngine } from "../engineBridge";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";
import { defaultOptimizationPriorities } from "../optimizationPriorities";
import { normalizeCourseCode } from "../utils/courseUtils";

export function generationResponse(over: Partial<GenerationResponseType>): GenerationResponseType {
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

export function makeRelaxationCatalogue(): Catalogue {
  return {
    courses: [
      { code: normalizeCourseCode("AAA 1000"), title: "A", credits: 3, description: "" },
      { code: normalizeCourseCode("BBB 1000"), title: "B", credits: 3, description: "" },
    ],
    programs: [],
  };
}

export function testSection(
  part: Partial<ComponentSection> & { section: string },
): ComponentSection {
  return {
    sectionCode: null,
    component: null,
    session: null,
    times: [],
    status: null,
    ...part,
  };
}

export function testCourseSchedule(
  code: string,
  components: Record<string, ComponentSection[]>,
): CourseSchedule {
  return {
    subject: code.split(" ")[0],
    catalogNumber: code.split(" ")[1] ?? "1000",
    courseCode: code as NormalizedCourseCode,
    title: code,
    timeZone: "America/Toronto",
    components,
  };
}

export function testLectureSchedule(
  code: string,
  day: DayOfWeekCode,
  startMinutes: number,
  endMinutes: number,
): CourseSchedule {
  return testCourseSchedule(code, {
    LEC: [
      testSection({
        section: "A",
        times: [{ day, startMinutes, endMinutes, virtual: false }],
      }),
    ],
  });
}

/**
 * Builds a single-LEC (`M00`) {@link CourseSchedule} from a list of meeting
 * times. Shared fixture for generation tests that need a course meeting at
 * several specific day/time slots.
 */
export function lectureScheduleWithTimes(
  courseCode: string,
  times: { day: DayOfWeekCode; start: number; end: number }[],
): CourseSchedule {
  const [subject, catalogNumber] = courseCode.split(" ");
  return {
    subject,
    catalogNumber,
    courseCode: normalizeCourseCode(courseCode),
    title: null,
    timeZone: "America/Toronto",
    components: {
      LEC: [
        {
          section: "M00",
          sectionCode: "M00",
          component: "LEC",
          session: null,
          times: times.map((t) => ({
            day: t.day,
            startMinutes: t.start,
            endMinutes: t.end,
            virtual: false,
          })),
          status: null,
        },
      ],
    },
  };
}

export function fakeDataCache(schedules: CourseSchedule[]): DataCache {
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

export const testGenerationConstraints: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 1440,
  maxFirstYearCredits: 24,
  professorRatings: {},
  blockedTimes: [],
};

export function decodedState(over: Partial<DecodedState> = {}): DecodedState {
  return {
    wizardMode: "basic",
    basketCourses: [],
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
    generationLimitFirstYearCredits: false,
    optimizationPriorities: defaultOptimizationPriorities(),
    activeStep: 0,
    showCalendar: false,
    frenchImmersionStream: false,
    calendarWeekIndex: null,
    blacklistedCourses: [],
    blockedTimes: [],
    ...over,
  };
}

export function engineReturning(
  courses: Array<{ courseCode: string; components: Array<{ component: string; section: string }> }>,
): ScheduleEngine {
  return {
    generate: () =>
      GenerationResponse.encode(
        generationResponse({ hasSchedule: courses.length > 0, courses }),
      ).finish(),
    timetable_fixed_set: () => new Uint8Array(),
  };
}

export function engineCapturingRequest(
  response: Partial<GenerationResponseType> = { hasSchedule: false },
): { engine: ScheduleEngine; getRequest: () => GenerationRequest | null } {
  let request: GenerationRequest | null = null;
  return {
    engine: {
      generate: (bytes) => {
        request = GenerationRequest.decode(bytes);
        return GenerationResponse.encode(generationResponse(response)).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    },
    getRequest: () => request,
  };
}
