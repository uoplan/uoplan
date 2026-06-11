import { describe, it, expect, beforeEach } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, CourseSchedule, GeneratedSchedule, MeetingTime } from "@uoplan/core";
import { defaultAppStore } from "../appStore";
import { testCourseCode } from "../../test/brands";

function time(day: MeetingTime["day"], startMinutes: number, endMinutes: number): MeetingTime {
  return { day, startMinutes, endMinutes, virtual: false };
}

function course(code: string): Catalogue["courses"][number] {
  return { code: testCourseCode(code), title: code, credits: 3, description: "", component: "LEC" };
}

function schedule(code: string, meetingTime: MeetingTime): CourseSchedule {
  const [subject, catalogNumber] = code.split(" ");
  return {
    subject,
    catalogNumber,
    courseCode: testCourseCode(code),
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

const monMorning = time("Mo", 540, 600);
const tueMorning = time("Tu", 540, 600);
const wedMorning = time("We", 540, 600);

const catalogue: Catalogue = {
  courses: [course("OLD 1100"), course("FIX 1100"), course("NEW 1100"), course("BAD 1100")],
  programs: [],
};

function buildCache() {
  return buildDataCache(catalogue, {
    termId: "2261",
    schedules: [
      schedule("OLD 1100", monMorning),
      schedule("FIX 1100", tueMorning),
      schedule("NEW 1100", wedMorning), // free slot
      schedule("BAD 1100", tueMorning), // clashes with FIX 1100
    ],
  });
}

describe("swapCourseInSchedule (advanced mode)", () => {
  beforeEach(() => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      calendarMode: "advanced",
      cache: buildCache(),
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
      currentSeed: 7,
      currentSwaps: [],
      swapsPerSeed: {},
      chosenCourseToRequirementId: { "OLD 1100": "req-a" },
      currentPoolMap: { "OLD 1100": "req-a" },
      currentColorMap: { "OLD 1100": 0, "FIX 1100": 1 },
      currentSchedule: {
        enrollments: [enrollment("OLD 1100", monMorning), enrollment("FIX 1100", tueMorning)],
      },
    });
  });

  it("applies a feasible swap and records it under the current seed", async () => {
    await defaultAppStore.getState().swapCourseInSchedule(0, testCourseCode("NEW 1100"));
    const s = defaultAppStore.getState();
    expect(s.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "NEW 1100",
      "FIX 1100",
    ]);
    // pool + colour carried from OLD to NEW
    expect(s.currentPoolMap).toEqual({ "OLD 1100": "req-a", "NEW 1100": "req-a" });
    expect(s.currentColorMap).toEqual({ "FIX 1100": 1, "NEW 1100": 0 });
    // swap bookkeeping
    expect(s.currentSwaps).toEqual([{ enrollmentIndex: 0, courseCode: "NEW 1100" }]);
    expect(s.swapsPerSeed[7]).toEqual([{ enrollmentIndex: 0, courseCode: "NEW 1100" }]);
  });

  it("leaves the schedule and swap log unchanged when the only section conflicts", async () => {
    await defaultAppStore.getState().swapCourseInSchedule(0, testCourseCode("BAD 1100"));
    const s = defaultAppStore.getState();
    expect(s.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
    expect(s.currentSwaps).toEqual([]);
    expect(s.swapsPerSeed).toEqual({});
    expect(s.currentColorMap).toEqual({ "OLD 1100": 0, "FIX 1100": 1 });
  });

  it("does nothing when the target course has no schedule data", async () => {
    await defaultAppStore.getState().swapCourseInSchedule(0, testCourseCode("ZZZ 9999"));
    const s = defaultAppStore.getState();
    expect(s.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
    expect(s.currentSwaps).toEqual([]);
  });
});
