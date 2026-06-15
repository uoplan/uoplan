import { buildDataCache } from "@uoplan/core";
import type {
  Catalogue,
  CourseSchedule,
  GeneratedSchedule,
  MeetingTime,
  SchedulesData,
} from "@uoplan/core";
import type { ScheduleGenerationResult } from "../slices/schedules/types";
import { testCourseCode } from "./brands";

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

export const swapTimes = {
  monMorning: testMeetingTime("Mo", 540, 600),
  tueMorning: testMeetingTime("Tu", 540, 600),
  wedMorning: testMeetingTime("We", 540, 600),
};

export function buildSwapCache() {
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
