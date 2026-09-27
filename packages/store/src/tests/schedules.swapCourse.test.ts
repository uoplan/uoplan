import { beforeEach, describe, expect, it } from "vitest";
import { buildDataCache } from "@uoplan/core";
import { testCourseCode } from "./brands";
import { testCatalogue, testSchedule, testSchedulesData } from "./scheduleBuilders";
import { resetSwapStore, testStore } from "./scheduleStoreHelpers";

describe("swapCourseInSchedule (advanced mode)", () => {
  beforeEach(() => resetSwapStore("advanced"));

  function currentEnrollmentCodes() {
    return testStore.getState().currentSchedule!.enrollments.map((e) => e.courseCode);
  }

  async function expectSwapLeavesScheduleUnchanged(targetCourse: string) {
    await testStore.getState().swapCourseInSchedule(0, testCourseCode(targetCourse));
    const s = testStore.getState();
    expect(currentEnrollmentCodes()).toEqual(["OLD 1100", "FIX 1100"]);
    expect(s.currentSwaps).toEqual([]);
    return s;
  }

  it("applies a feasible swap and records it under the current seed", async () => {
    await testStore.getState().swapCourseInSchedule(0, testCourseCode("NEW 1100"));
    const s = testStore.getState();
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

  it("keeps the additional-electives virtual filter when applying a swap", async () => {
    const catalogue = testCatalogue(["OLD 1100", "FIX 1100", "NEW 1100"]);
    testStore.setState({
      cache: buildDataCache(
        catalogue,
        testSchedulesData([
          testSchedule("OLD 1100", {
            day: "Mo",
            startMinutes: 540,
            endMinutes: 600,
            virtual: true,
          }),
          testSchedule("FIX 1100", {
            day: "Tu",
            startMinutes: 540,
            endMinutes: 600,
            virtual: false,
          }),
          testSchedule("NEW 1100", {
            day: "We",
            startMinutes: 540,
            endMinutes: 600,
            virtual: false,
          }),
        ]),
      ),
      virtualSectionsOnly: true,
      currentPoolMap: { "OLD 1100": "__additional_electives__" },
    });

    await expectSwapLeavesScheduleUnchanged("NEW 1100");
  });
});
