import { describe, expect, it } from "vitest";
import { basicElectivesAfterPinnedDelta, canGenerateBasicSchedule } from "./basicCalendarPins";

describe("canGenerateBasicSchedule", () => {
  it("is false when there are no required courses and electives are 0", () => {
    expect(canGenerateBasicSchedule(0, 0)).toBe(false);
  });

  it("is true when there is at least one required course or elective slot", () => {
    expect(canGenerateBasicSchedule(1, 0)).toBe(true);
    expect(canGenerateBasicSchedule(0, 1)).toBe(true);
  });
});

describe("basicElectivesAfterPinnedDelta", () => {
  it("decrements electives when a required course is pinned", () => {
    expect(basicElectivesAfterPinnedDelta(4, 1)).toBe(3);
  });

  it("increments electives when a required course is unpinned", () => {
    expect(basicElectivesAfterPinnedDelta(2, -1)).toBe(3);
  });

  it("clamps to 0 and 8", () => {
    expect(basicElectivesAfterPinnedDelta(0, 1)).toBe(0);
    expect(basicElectivesAfterPinnedDelta(8, -1)).toBe(8);
  });
});
