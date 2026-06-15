import { beforeEach, describe, expect, it } from "vitest";
import { applySwapsToResult } from "../slices/schedules/swapHelpers";
import { baseSwapResult } from "./scheduleBuilders";
import { resetSwapStore, testStore } from "./scheduleStoreHelpers";

describe("applySwapsToResult", () => {
  beforeEach(() => resetSwapStore("basic"));

  it("returns the result untouched when there are no swaps", () => {
    const result = baseSwapResult();
    expect(applySwapsToResult(result, [], testStore.getState())).toBe(result);
  });

  it("returns the result untouched when there is no current schedule", () => {
    const result = { ...baseSwapResult(), currentSchedule: null };
    expect(
      applySwapsToResult(
        result,
        [{ enrollmentIndex: 0, courseCode: "NEW 1100" }],
        testStore.getState(),
      ),
    ).toBe(result);
  });

  it("applies a feasible swap, moving pool and colour onto the new course", () => {
    const out = applySwapsToResult(
      baseSwapResult(),
      [{ enrollmentIndex: 0, courseCode: "NEW 1100" }],
      testStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "NEW 1100",
      "FIX 1100",
    ]);
    // pool membership follows the swapped-in course
    expect(out.currentPoolMap).toEqual({ "OLD 1100": "req-a", "NEW 1100": "req-a" });
    // colour index transferred from OLD to NEW; OLD dropped
    expect(out.currentColorMap).toEqual({ "FIX 1100": 1, "NEW 1100": 0 });
  });

  it("skips a swap whose only section overlaps a fixed course", () => {
    const out = applySwapsToResult(
      baseSwapResult(),
      [{ enrollmentIndex: 0, courseCode: "BAD 1100" }],
      testStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
    expect(out.currentColorMap).toEqual({ "OLD 1100": 0, "FIX 1100": 1 });
  });

  it("skips a swap to a course with no schedule data", () => {
    const out = applySwapsToResult(
      baseSwapResult(),
      [{ enrollmentIndex: 0, courseCode: "ZZZ 9999" }],
      testStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
  });

  it("applies multiple swaps in sequence", () => {
    const out = applySwapsToResult(
      baseSwapResult(),
      [
        { enrollmentIndex: 0, courseCode: "NEW 1100" }, // OLD -> NEW (We)
        { enrollmentIndex: 0, courseCode: "OLD 1100" }, // NEW -> OLD (Mo) again
      ],
      testStore.getState(),
    );
    expect(out.currentSchedule!.enrollments.map((e) => e.courseCode)).toEqual([
      "OLD 1100",
      "FIX 1100",
    ]);
  });
});
