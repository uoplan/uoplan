import { beforeEach, describe, expect, it } from "vitest";
import type { GeneratedSchedule } from "@uoplan/core";
import { defaultAppStore } from "../appStore";

const schedule: GeneratedSchedule = {
  enrollments: [{ courseCode: "ITI 1120", sectionCombo: {} }],
} as unknown as GeneratedSchedule;

describe("importSchedule", () => {
  beforeEach(() => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      currentSchedule: null,
      calendarWeekIndex: 3,
    });
  });

  it("resets calendarWeekIndex to null so the calendar defaults to the busiest week", () => {
    expect(defaultAppStore.getState().calendarWeekIndex).toBe(3);
    defaultAppStore.getState().importSchedule(schedule);
    expect(defaultAppStore.getState().calendarWeekIndex).toBeNull();
    expect(defaultAppStore.getState().currentSchedule).toBe(schedule);
  });
});
