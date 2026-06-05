import { describe, it, expect, beforeEach } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, CourseSchedule, GeneratedSchedule, MeetingTime } from "@uoplan/core";
import { defaultAppStore } from "../appStore";

function time(day: MeetingTime["day"], startMinutes: number, endMinutes: number): MeetingTime {
  return { day, startMinutes, endMinutes, virtual: false };
}

function course(code: string): Catalogue["courses"][number] {
  return { code, title: code, credits: 3, description: "", component: "LEC" };
}

function schedule(code: string, meetingTime: MeetingTime): CourseSchedule {
  const [subject, catalogNumber] = code.split(" ");
  return {
    subject,
    catalogNumber,
    courseCode: code,
    title: code,
    timeZone: "America/Toronto",
    components: {
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
    },
  };
}

function enrollment(
  code: string,
  meetingTime: MeetingTime,
): GeneratedSchedule["enrollments"][number] {
  return {
    courseCode: code,
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

describe("basic getSwapCandidates", () => {
  beforeEach(() => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      calendarMode: null,
      basicPinnedCourses: [],
      basicExcludedCategories: [],
      currentSchedule: null,
      cache: null,
      completedCourses: [],
      studentPrograms: [],
      levelBuckets: ["undergrad"],
      languageBuckets: ["en"],
      electiveLevelBuckets: [],
      generationMinStartMinutes: 0,
      generationMaxEndMinutes: 24 * 60,
      generationMinProfessorRating: null,
      professorRatings: null,
      includeClosedComponents: false,
      virtualSectionsOnly: false,
      blockedTimes: [],
    });
  });

  it("excludes candidates that cannot timetable with the remaining fixed courses", () => {
    const oldTime = time("Mo", 600, 660);
    const fixedTime = time("Mo", 540, 600);
    const conflictingTime = time("Mo", 540, 600);
    const fittingTime = time("Mo", 660, 720);
    const cache = buildDataCache(
      {
        courses: [course("OLD 1100"), course("FIX 1100"), course("BAD 1100"), course("GOOD 1100")],
        programs: [],
      },
      {
        termId: "2261",
        schedules: [
          schedule("OLD 1100", oldTime),
          schedule("FIX 1100", fixedTime),
          schedule("BAD 1100", conflictingTime),
          schedule("GOOD 1100", fittingTime),
        ],
      },
    );

    defaultAppStore.setState({
      calendarMode: "basic",
      cache,
      currentSchedule: {
        enrollments: [enrollment("OLD 1100", oldTime), enrollment("FIX 1100", fixedTime)],
      },
    });

    const result = defaultAppStore.getState().getSwapCandidates(0);

    expect(result.candidates).toContain("GOOD 1100");
    expect(result.candidates).not.toContain("BAD 1100");
  });
});
