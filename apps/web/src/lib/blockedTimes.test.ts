import { describe, expect, it } from "vitest";
import {
  avoidWindowForDay,
  avoidedDaysFromBlocks,
  blockedWindowId,
  defaultBlockedTimes,
  isDayAvoided,
  normalizeBlockedTimes,
  reconcileAvoidedDays,
  toBlockedWindows,
  withBlockedIds,
} from "./blockedTimes";
import type { BlockedTime } from "../store/types";

const block = (day: BlockedTime["day"], startMinutes: number, endMinutes: number): BlockedTime => ({
  id: "x",
  day,
  startMinutes,
  endMinutes,
});

describe("blockedTimes helpers", () => {
  it("derives a deterministic id from a window", () => {
    expect(blockedWindowId({ day: "Mo", startMinutes: 540, endMinutes: 600 })).toBe("Mo-540-600");
  });

  it("strips ids down to core windows", () => {
    expect(toBlockedWindows([block("Mo", 540, 600)])).toEqual([
      { day: "Mo", startMinutes: 540, endMinutes: 600 },
    ]);
  });

  it("reattaches deterministic ids", () => {
    expect(withBlockedIds([{ day: "Tu", startMinutes: 600, endMinutes: 660 }])).toEqual([
      { id: "Tu-600-660", day: "Tu", startMinutes: 600, endMinutes: 660 },
    ]);
  });

  it("merges overlapping same-day windows and reassigns ids", () => {
    const result = normalizeBlockedTimes([block("Mo", 540, 660), block("Mo", 600, 720)]);
    expect(result).toEqual([{ id: "Mo-540-720", day: "Mo", startMinutes: 540, endMinutes: 720 }]);
  });

  it("keeps blocks on different days separate", () => {
    const result = normalizeBlockedTimes([block("Mo", 540, 600), block("Tu", 540, 600)]);
    expect(result).toHaveLength(2);
  });

  it("merges touching (adjacent) blocks into one region", () => {
    const result = normalizeBlockedTimes([block("Mo", 540, 600), block("Mo", 600, 660)]);
    expect(result).toEqual([{ id: "Mo-540-660", day: "Mo", startMinutes: 540, endMinutes: 660 }]);
  });
});

describe("avoided-day helpers", () => {
  const AVOID_START = 510;
  const AVOID_END = 1320;

  it("defaults to avoiding the weekend", () => {
    expect(avoidedDaysFromBlocks(defaultBlockedTimes()).sort()).toEqual(["Sa", "Su"]);
  });

  it("treats a full avoid-span window as avoided, partial as not", () => {
    expect(isDayAvoided([block("Mo", AVOID_START, AVOID_END)], "Mo")).toBe(true);
    // Wider-than-span (e.g. after a merge) still counts as avoided.
    expect(isDayAvoided([block("Mo", 480, 1380)], "Mo")).toBe(true);
    // A partial block does not mark the day avoided.
    expect(isDayAvoided([block("Mo", 600, 720)], "Mo")).toBe(false);
  });

  it("adds a full avoid window when a day becomes avoided", () => {
    const result = reconcileAvoidedDays([], ["Sa"]);
    expect(result).toEqual([withBlockedIds([avoidWindowForDay("Sa")])[0]]);
  });

  it("subtracts the avoid span but preserves remainder when un-avoiding", () => {
    // A manual all-day block (08:00–23:00) that also covers the avoid span.
    const result = reconcileAvoidedDays([block("Mo", 480, 1380)], []);
    expect(result).toEqual([
      { id: "Mo-480-510", day: "Mo", startMinutes: 480, endMinutes: AVOID_START },
      { id: "Mo-1320-1380", day: "Mo", startMinutes: AVOID_END, endMinutes: 1380 },
    ]);
  });

  it("leaves partial blocks untouched when un-avoiding a day", () => {
    const result = reconcileAvoidedDays([block("Mo", 600, 720)], []);
    expect(result).toEqual([{ id: "Mo-600-720", day: "Mo", startMinutes: 600, endMinutes: 720 }]);
  });

  it("is idempotent when the avoided set already matches", () => {
    const start = defaultBlockedTimes();
    expect(reconcileAvoidedDays(start, ["Sa", "Su"])).toEqual(start);
  });
});
