import { beforeEach, describe, expect, it } from "vitest";
import type { GeneratedSchedule } from "@uoplan/core";
import { testStore } from "./scheduleStoreHelpers";

const schedule: GeneratedSchedule = {
  enrollments: [{ courseCode: "ITI 1120", sectionCombo: {} }],
} as unknown as GeneratedSchedule;

describe("importSchedule", () => {
  beforeEach(() => {
    testStore.setState({
      ...testStore.getState(),
      currentSchedule: null,
      calendarWeekIndex: 3,
    });
  });

  it("resets calendarWeekIndex to null so the calendar defaults to the busiest week", () => {
    expect(testStore.getState().calendarWeekIndex).toBe(3);
    testStore.getState().importSchedule(schedule);
    expect(testStore.getState().calendarWeekIndex).toBeNull();
    expect(testStore.getState().currentSchedule).toBe(schedule);
  });
});
