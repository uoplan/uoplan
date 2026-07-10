import { describe, expect, it } from "vitest";
import { mergeBlockedWindows } from "../blockedTimes";
import type { BlockedTimeWindow } from "../types";

describe("mergeBlockedWindows", () => {
  it("merges strictly overlapping windows on the same day", () => {
    const input: BlockedTimeWindow[] = [
      { day: "Mo", startMinutes: 600, endMinutes: 720 },
      { day: "Mo", startMinutes: 660, endMinutes: 780 },
    ];
    expect(mergeBlockedWindows(input)).toEqual([{ day: "Mo", startMinutes: 600, endMinutes: 780 }]);
  });

  it("merges windows that touch into one region", () => {
    const input: BlockedTimeWindow[] = [
      { day: "Mo", startMinutes: 600, endMinutes: 660 },
      { day: "Mo", startMinutes: 660, endMinutes: 720 },
    ];
    expect(mergeBlockedWindows(input)).toEqual([{ day: "Mo", startMinutes: 600, endMinutes: 720 }]);
  });

  it("keeps windows on different days separate", () => {
    const input: BlockedTimeWindow[] = [
      { day: "Mo", startMinutes: 600, endMinutes: 700 },
      { day: "Tu", startMinutes: 600, endMinutes: 700 },
    ];
    const result = mergeBlockedWindows(input);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ day: "Mo", startMinutes: 600, endMinutes: 700 });
    expect(result).toContainEqual({ day: "Tu", startMinutes: 600, endMinutes: 700 });
  });

  it("merges a chain of overlapping windows into one", () => {
    const input: BlockedTimeWindow[] = [
      { day: "We", startMinutes: 600, endMinutes: 660 },
      { day: "We", startMinutes: 650, endMinutes: 700 },
      { day: "We", startMinutes: 690, endMinutes: 800 },
    ];
    expect(mergeBlockedWindows(input)).toEqual([{ day: "We", startMinutes: 600, endMinutes: 800 }]);
  });

  it("drops zero and negative length windows", () => {
    const input: BlockedTimeWindow[] = [
      { day: "Fr", startMinutes: 600, endMinutes: 600 },
      { day: "Fr", startMinutes: 700, endMinutes: 650 },
      { day: "Fr", startMinutes: 800, endMinutes: 860 },
    ];
    expect(mergeBlockedWindows(input)).toEqual([{ day: "Fr", startMinutes: 800, endMinutes: 860 }]);
  });

  it("does not mutate the input array or its items", () => {
    const input: BlockedTimeWindow[] = [
      { day: "Mo", startMinutes: 600, endMinutes: 720 },
      { day: "Mo", startMinutes: 660, endMinutes: 780 },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    mergeBlockedWindows(input);
    expect(input).toEqual(snapshot);
  });
});
