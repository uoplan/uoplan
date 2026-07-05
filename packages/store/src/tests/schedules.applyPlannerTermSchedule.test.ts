import { beforeEach, describe, expect, it } from "vitest";
import type { GeneratedSchedule } from "@uoplan/core";
import { testStore } from "./scheduleStoreHelpers";

const schedule: GeneratedSchedule = {
  enrollments: [{ courseCode: "ITI 1120", sectionCombo: {} }],
} as unknown as GeneratedSchedule;

const bundle = {
  currentSchedule: schedule,
  swapPool: ["CSI 2110"],
  chosenCourseToRequirementId: { "ITI 1120": "req-1" },
  currentPoolMap: { "ITI 1120": "pool-1" },
  currentColorMap: { "ITI 1120": 2 },
  generationError: null,
};

describe("applyPlannerTermSchedule", () => {
  beforeEach(() => {
    testStore.setState({
      ...testStore.getState(),
      currentSchedule: null,
      coursesThisSemester: 5,
      generationOptionsDirty: true,
      calendarWeekIndex: 3,
      currentSwaps: [{ enrollmentIndex: 0, courseCode: "X" as never }],
    });
  });

  it("forwards a planner term's exact schedule + count and settles the calendar", () => {
    testStore.getState().applyPlannerTermSchedule(bundle, 3);
    const s = testStore.getState();
    expect(s.currentSchedule).toBe(schedule);
    expect(s.swapPool).toEqual(["CSI 2110"]);
    expect(s.chosenCourseToRequirementId).toEqual({ "ITI 1120": "req-1" });
    expect(s.currentPoolMap).toEqual({ "ITI 1120": "pool-1" });
    expect(s.currentColorMap).toEqual({ "ITI 1120": 2 });
    expect(s.coursesThisSemester).toBe(3);
    // Dirty flag cleared last so the calendar shows the schedule as settled.
    expect(s.generationOptionsDirty).toBe(false);
    expect(s.currentSwaps).toEqual([]);
    expect(s.calendarWeekIndex).toBeNull();
  });
});
