import { describe, expect, it } from "vitest";
import {
  blockedWindowId,
  normalizeBlockedTimes,
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
