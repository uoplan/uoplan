import { buildDataCache } from "@uoplan/core";
import type {
  Catalogue,
  CourseSchedule,
  GeneratedSchedule,
  MeetingTime,
  SchedulesData,
} from "@uoplan/core";
import { defaultAppStore } from "../appStore";
import type { AppStore } from "../types";
import type { ScheduleGenerationResult } from "../slices/schedules/types";
import { testCourseCode } from "../../test/brands";

export function testMeetingTime(
  day: MeetingTime["day"],
  startMinutes: number,
  endMinutes: number,
): MeetingTime {
  return { day, startMinutes, endMinutes, virtual: false };
}

export function testCourse(code: string): Catalogue["courses"][number] {
  return { code: testCourseCode(code), title: code, credits: 3, description: "", component: "LEC" };
}

export function testCatalogue(codes: string[]): Catalogue {
  return { courses: codes.map(testCourse), programs: [] };
}

export function testSchedule(code: string, meetingTime?: MeetingTime): CourseSchedule {
  const [subject, catalogNumber] = code.split(" ");
  return {
    subject,
    catalogNumber,
    courseCode: testCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components: meetingTime
      ? {
          LEC: [
            {
              section: "A00",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              times: [meetingTime],
              status: "Open",
            },
          ],
        }
      : {},
  };
}

export function testSchedulesData(
  schedules: CourseSchedule[],
  termId: SchedulesData["termId"] = "2261",
): SchedulesData {
  return { termId, schedules };
}

export function testEnrollment(
  code: string,
  meetingTime: MeetingTime,
): GeneratedSchedule["enrollments"][number] {
  return {
    courseCode: testCourseCode(code),
    sectionCombo: {
      LEC: {
        section: {
          section: "A00",
          sectionCode: "A00",
          component: "LEC",
          session: null,
          times: [meetingTime],
          status: "Open",
        },
      },
    },
    times: [meetingTime],
  };
}

const swapTimes = {
  monMorning: testMeetingTime("Mo", 540, 600),
  tueMorning: testMeetingTime("Tu", 540, 600),
  wedMorning: testMeetingTime("We", 540, 600),
};

function buildSwapCache() {
  const { monMorning, tueMorning, wedMorning } = swapTimes;
  const catalogue = testCatalogue(["OLD 1100", "FIX 1100", "NEW 1100", "BAD 1100"]);
  return buildDataCache(
    catalogue,
    testSchedulesData([
      testSchedule("OLD 1100", monMorning),
      testSchedule("FIX 1100", tueMorning),
      testSchedule("NEW 1100", wedMorning),
      testSchedule("BAD 1100", tueMorning),
    ]),
  );
}

export function baseSwapResult(): ScheduleGenerationResult {
  const { monMorning, tueMorning } = swapTimes;
  return {
    currentSchedule: {
      enrollments: [testEnrollment("OLD 1100", monMorning), testEnrollment("FIX 1100", tueMorning)],
    },
    swapPool: [],
    chosenCourseToRequirementId: { "OLD 1100": "req-a" },
    currentPoolMap: { "OLD 1100": "req-a" },
    currentColorMap: { "OLD 1100": 0, "FIX 1100": 1 },
    generationError: null,
  };
}

export function emptyScheduleGenerationResult(): ScheduleGenerationResult {
  return {
    currentSchedule: { enrollments: [] },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  };
}

type ScheduleGenerationMock = {
  mockReset: () => unknown;
  mockResolvedValue: (result: ScheduleGenerationResult) => unknown;
};

export function resetStoreForSeedTests(
  generateSchedulesActionMock: ScheduleGenerationMock,
  firstSeed: number,
  overrides: Partial<AppStore> = {},
) {
  generateSchedulesActionMock.mockReset();
  generateSchedulesActionMock.mockResolvedValue(emptyScheduleGenerationResult());
  defaultAppStore.setState({
    ...defaultAppStore.getState(),
    firstSeed,
    currentSeed: 0,
    lowestVisitedSeed: null,
    currentSchedule: null,
    scheduleGenerating: false,
    currentSwaps: [],
    ...overrides,
  });
}

export function resetSwapStore(calendarMode: "basic" | "advanced" = "basic") {
  const { monMorning, tueMorning } = swapTimes;
  defaultAppStore.setState({
    ...defaultAppStore.getState(),
    calendarMode,
    cache: buildSwapCache(),
    generationMinStartMinutes: 0,
    generationMaxEndMinutes: 24 * 60,
    generationMinProfessorRating: null,
    professorRatings: null,
    includeClosedComponents: true,
    virtualSectionsOnly: false,
    remainingRequirements: [],
    constrainedPerRequirement: {},
    selectedPerRequirement: {},
    blockedTimes: [],
    currentSchedule:
      calendarMode === "advanced"
        ? {
            enrollments: [
              testEnrollment("OLD 1100", monMorning),
              testEnrollment("FIX 1100", tueMorning),
            ],
          }
        : null,
    currentSeed: 7,
    currentSwaps: [],
    swapsPerSeed: {},
    chosenCourseToRequirementId: { "OLD 1100": "req-a" },
    currentPoolMap: { "OLD 1100": "req-a" },
    currentColorMap: { "OLD 1100": 0, "FIX 1100": 1 },
  });
}
