import { describe, expect, it } from "vitest";
import { basicElectivesAfterPinnedDelta } from "./basicCalendarPins";

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
