import { describe, it, expect, beforeEach } from "vitest";
import { defaultAppStore } from "../appStore";
import { testCourseCode } from "../../test/brands";
import { resetSwapStore } from "./scheduleTestHelpers";

describe("swapCourseInSchedule (advanced mode)", () => {
  beforeEach(() => resetSwapStore("advanced"));

  function currentEnrollmentCodes() {
    return defaultAppStore.getState().currentSchedule!.enrollments.map((e) => e.courseCode);
  }

  async function expectSwapLeavesScheduleUnchanged(targetCourse: string) {
    await defaultAppStore.getState().swapCourseInSchedule(0, testCourseCode(targetCourse));
    const s = defaultAppStore.getState();
    expect(currentEnrollmentCodes()).toEqual(["OLD 1100", "FIX 1100"]);
    expect(s.currentSwaps).toEqual([]);
    return s;
  }

  it("applies a feasible swap and records it under the current seed", async () => {
    await defaultAppStore.getState().swapCourseInSchedule(0, testCourseCode("NEW 1100"));
    const s = defaultAppStore.getState();
    expect(currentEnrollmentCodes()).toEqual(["NEW 1100", "FIX 1100"]);
    // pool + colour carried from OLD to NEW
    expect(s.currentPoolMap).toEqual({ "OLD 1100": "req-a", "NEW 1100": "req-a" });
    expect(s.currentColorMap).toEqual({ "FIX 1100": 1, "NEW 1100": 0 });
    // swap bookkeeping
    expect(s.currentSwaps).toEqual([{ enrollmentIndex: 0, courseCode: "NEW 1100" }]);
    expect(s.swapsPerSeed[7]).toEqual([{ enrollmentIndex: 0, courseCode: "NEW 1100" }]);
  });

  it("leaves the schedule and swap log unchanged when the only section conflicts", async () => {
    const s = await expectSwapLeavesScheduleUnchanged("BAD 1100");
    expect(s.swapsPerSeed).toEqual({});
    expect(s.currentColorMap).toEqual({ "OLD 1100": 0, "FIX 1100": 1 });
  });

  it("does nothing when the target course has no schedule data", async () => {
    await expectSwapLeavesScheduleUnchanged("ZZZ 9999");
  });
});
