import { describe, it, expect } from "vitest";
import {
  addDays,
  minutesToDate,
  minutesToTimeString,
  minutesToTime24,
  formatTimeRange,
  formatTimeRange24,
  DAY_OFFSETS,
  DAY_NAMES,
  getDayOffset,
  parseTimeToMinutes,
  getDurationMinutes,
  timeRangesOverlap,
} from "../utils/timeUtils";

describe("addDays", () => {
  it("adds days without mutating the input", () => {
    const base = new Date(2024, 0, 1, 9, 30, 0, 0);
    const out = addDays(base, 5);
    expect(out.getDate()).toBe(6);
    // original unchanged
    expect(base.getDate()).toBe(1);
    // time preserved
    expect(out.getHours()).toBe(9);
    expect(out.getMinutes()).toBe(30);
  });

  it("handles negative amounts and month rollover", () => {
    const base = new Date(2024, 2, 1); // Mar 1
    const out = addDays(base, -1);
    expect(out.getMonth()).toBe(1); // Feb
    expect(out.getDate()).toBe(29); // 2024 is a leap year
  });
});

describe("minutesToDate", () => {
  it("sets hours/minutes from total minutes on the base date", () => {
    const base = new Date(2024, 0, 1);
    const out = minutesToDate(base, 510); // 08:30
    expect(out.getHours()).toBe(8);
    expect(out.getMinutes()).toBe(30);
    expect(out.getSeconds()).toBe(0);
    expect(out.getDate()).toBe(1);
  });

  it("does not mutate the base date", () => {
    const base = new Date(2024, 0, 1, 23, 0, 0);
    minutesToDate(base, 0);
    expect(base.getHours()).toBe(23);
  });
});

describe("minutesToTimeString (12-hour)", () => {
  it.each([
    [0, "12:00 AM"],
    [510, "8:30 AM"],
    [690, "11:30 AM"],
    [720, "12:00 PM"],
    [780, "1:00 PM"],
    [1439, "11:59 PM"],
  ])("formats %i as %s", (mins, expected) => {
    expect(minutesToTimeString(mins)).toBe(expected);
  });
});

describe("minutesToTime24", () => {
  it.each([
    [0, "00:00"],
    [510, "08:30"],
    [720, "12:00"],
    [1439, "23:59"],
  ])("formats %i as %s", (mins, expected) => {
    expect(minutesToTime24(mins)).toBe(expected);
  });
});

describe("formatTimeRange", () => {
  it("joins start and end with a dash in 12-hour format", () => {
    expect(formatTimeRange(510, 620)).toBe("8:30 AM - 10:20 AM");
  });
});

describe("formatTimeRange24", () => {
  it("uses 24-hour format with the default separator", () => {
    expect(formatTimeRange24(510, 620)).toBe("08:30 - 10:20");
  });

  it("honours a custom separator", () => {
    expect(formatTimeRange24(510, 620, "–")).toBe("08:30–10:20");
  });
});

describe("day lookups", () => {
  it("maps abbreviations to Sunday-zero offsets", () => {
    expect(DAY_OFFSETS).toMatchObject({ Su: 0, Mo: 1, Sa: 6 });
    expect(getDayOffset("We")).toBe(3);
  });

  it("defaults unknown abbreviations to 0 (Sunday)", () => {
    expect(getDayOffset("XX")).toBe(0);
  });

  it("provides full day names", () => {
    expect(DAY_NAMES.Mo).toBe("Monday");
    expect(DAY_NAMES.Su).toBe("Sunday");
  });
});

describe("parseTimeToMinutes", () => {
  it("parses valid HH:MM strings", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("0:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("rejects malformed or out-of-range times", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("8:5")).toBeNull(); // minutes must be two digits
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("12:60")).toBeNull();
    expect(parseTimeToMinutes("noon")).toBeNull();
    expect(parseTimeToMinutes("08:30:00")).toBeNull();
  });
});

describe("getDurationMinutes", () => {
  it("returns the difference between end and start", () => {
    expect(getDurationMinutes(510, 620)).toBe(110);
    expect(getDurationMinutes(600, 600)).toBe(0);
  });
});

describe("timeRangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(timeRangesOverlap(0, 60, 30, 90)).toBe(true);
    expect(timeRangesOverlap(30, 90, 0, 60)).toBe(true);
    expect(timeRangesOverlap(0, 120, 30, 60)).toBe(true); // contained
  });

  it("treats touching endpoints as non-overlapping (half-open)", () => {
    expect(timeRangesOverlap(0, 60, 60, 120)).toBe(false);
    expect(timeRangesOverlap(60, 120, 0, 60)).toBe(false);
  });

  it("returns false for fully disjoint ranges", () => {
    expect(timeRangesOverlap(0, 60, 120, 180)).toBe(false);
  });
});
