import type { GenerationResponse as GenerationResponseType } from "@uoplan/proto/engine";
import type { NormalizedCourseCode } from "../brand";
import type { DataCache } from "../dataCache";
import type { Catalogue, ComponentSection, CourseSchedule, DayOfWeekCode } from "../dataTypes";
import type { GenerationConstraints } from "../generation/types";
import type { DecodedState } from "../stateEncode";
import type { ScheduleEngine } from "../engineBridge";
import { GenerationRequest, GenerationResponse, Mode } from "@uoplan/proto/engine";
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
  minProfessorRating: 0,
  maxFirstYearCredits: 24,
  professorRatings: {},
  blockedTimes: [],
};

export function decodedState(over: Partial<DecodedState> = {}): DecodedState {
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

export function engineCapturingGenerationMode(
  response: Partial<GenerationResponseType> = { hasSchedule: false },
): { engine: ScheduleEngine; getMode: () => Mode | null } {
  let mode: Mode | null = null;
  return {
    engine: {
      generate: (bytes) => {
        mode = GenerationRequest.decode(bytes).mode;
        return GenerationResponse.encode(generationResponse(response)).finish();
      },
      timetable_fixed_set: () => new Uint8Array(),
    },
    getMode: () => mode,
  };
}
