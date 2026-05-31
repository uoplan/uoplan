import { describe, expect, it } from "vitest";
import {
  CAL_START_MINUTES,
  CAL_END_MINUTES,
  minutesToPercent,
  percentToMinutes,
  snapMinutes,
  clampToCalendarRange,
} from "@uoplan/calendar";

describe("calendar layout helpers", () => {
  it("percentToMinutes inverts minutesToPercent", () => {
    for (const minutes of [CAL_START_MINUTES, 600, 720, 1000, CAL_END_MINUTES]) {
      expect(Math.round(percentToMinutes(minutesToPercent(minutes)))).toBe(minutes);
    }
  });

  it("maps 0% to start and 100% to end", () => {
    expect(percentToMinutes(0)).toBe(CAL_START_MINUTES);
    expect(percentToMinutes(100)).toBe(CAL_END_MINUTES);
  });

  it("snaps minutes to a 5-minute grid by default", () => {
    expect(snapMinutes(602)).toBe(600);
    expect(snapMinutes(603)).toBe(605);
    expect(snapMinutes(607, 15)).toBe(600);
  });

  it("clamps minutes to the visible calendar range", () => {
    expect(clampToCalendarRange(0)).toBe(CAL_START_MINUTES);
    expect(clampToCalendarRange(9999)).toBe(CAL_END_MINUTES);
    expect(clampToCalendarRange(700)).toBe(700);
  });
});
