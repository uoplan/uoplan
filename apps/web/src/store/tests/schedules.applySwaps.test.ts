import { describe, it, expect, beforeEach } from "vitest";
import { buildDataCache } from "@uoplan/core";
import type { Catalogue, CourseSchedule, GeneratedSchedule, MeetingTime } from "@uoplan/core";
import { defaultAppStore } from "../appStore";
import { applySwapsToResult } from "../slices/schedules/swapHelpers";
import type { ScheduleGenerationResult } from "../slices/schedules/types";
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

function baseResult(): ScheduleGenerationResult {
  return {
    currentSchedule: {
      enrollments: [enrollment("OLD 1100", monMorning), enrollment("FIX 1100", tueMorning)],
    },
    swapPool: [],
    chosenCourseToRequirementId: { "OLD 1100": "req-a" },
    currentPoolMap: { "OLD 1100": "req-a" },
    currentColorMap: { "OLD 1100": 0, "FIX 1100": 1 },
    generationError: null,
  };
}

describe("applySwapsToResult", () => {
  beforeEach(() => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      calendarMode: "basic",
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
      currentSchedule: null,
    });
  });

  it("returns the result untouched when there are no swaps", () => {
    const result = baseResult();
    expect(applySwapsToResult(result, [], defaultAppStore.getState())).toBe(result);
  });

  it("returns the result untouched when there is no current schedule", () => {
    const result = { ...baseResult(), currentSchedule: null };
    expect(
      applySwapsToResult(
        result,
        [{ enrollmentIndex: 0, courseCode: "NEW 1100" }],
        defaultAppStore.getState(),
      ),
    ).toBe(result);
  });

  it("applies a feasible swap, moving pool and colour onto the new course", () => {
    const out = applySwapsToResult(
      baseResult(),
      [{ enrollmentIndex: 0, courseCode: "NEW 1100" }],
      defaultAppStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "NEW 1100",
      "FIX 1100",
    ]);
    // pool membership follows the swapped-in course
    expect(out.currentPoolMap).toEqual({ "OLD 1100": "req-a", "NEW 1100": "req-a" });
    // colour index transferred from OLD to NEW; OLD dropped
    expect(out.currentColorMap).toEqual({ "FIX 1100": 1, "NEW 1100": 0 });
  });

  it("skips a swap whose only section overlaps a fixed course", () => {
    const out = applySwapsToResult(
      baseResult(),
      [{ enrollmentIndex: 0, courseCode: "BAD 1100" }],
      defaultAppStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
    expect(out.currentColorMap).toEqual({ "OLD 1100": 0, "FIX 1100": 1 });
  });

  it("skips a swap to a course with no schedule data", () => {
    const out = applySwapsToResult(
      baseResult(),
      [{ enrollmentIndex: 0, courseCode: "ZZZ 9999" }],
      defaultAppStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
  });

  it("applies multiple swaps in sequence", () => {
    const out = applySwapsToResult(
      baseResult(),
      [
        { enrollmentIndex: 0, courseCode: "NEW 1100" }, // OLD -> NEW (We)
        { enrollmentIndex: 0, courseCode: "OLD 1100" }, // NEW -> OLD (Mo) again
      ],
      defaultAppStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
  });
});
