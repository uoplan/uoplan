import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let generateSchedulesCalls = 0;
const terminateSpy = vi.fn();

vi.mock("comlink", () => ({
  wrap: () => ({
    // Never resolves: simulates a long-running generation we will cancel.
    generateSchedules: () => {
      generateSchedulesCalls += 1;
      return new Promise(() => {});
    },
    loadData: () => Promise.resolve(),
  }),
}));

vi.mock("../lib/generateSchedulesAction", () => ({
  pickGenerateSchedulesInput: () => ({}),
}));

class FakeWorker {
  terminate = terminateSpy;
}

const fakeState = {
  selectedTermId: "2025",
  firstYear: 2024,
  completedCourses: [],
  remainingRequirements: [],
  optimizationPriorities: [],
  program: null,
  cache: null,
} as unknown as Parameters<typeof import("./scheduleWorkerClient").runScheduleGeneration>[0];

describe("scheduleWorkerClient cancellation", () => {
  beforeEach(() => {
    generateSchedulesCalls = 0;
    terminateSpy.mockClear();
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", {});
  });

  afterEach(async () => {
    const { __resetScheduleWorkerClientForTests } = await import("./scheduleWorkerClient");
    __resetScheduleWorkerClientForTests();
    vi.unstubAllGlobals();
  });

  it("cancelScheduleGeneration resolves the in-flight run to null and terminates the worker", async () => {
    const { runScheduleGeneration, cancelScheduleGeneration } =
      await import("./scheduleWorkerClient");

    const pending = runScheduleGeneration(fakeState, "advanced");
    // Let the worker call start before cancelling.
    await Promise.resolve();
    expect(generateSchedulesCalls).toBe(1);

    cancelScheduleGeneration();

    await expect(pending).resolves.toBeNull();
    expect(terminateSpy).toHaveBeenCalledTimes(1);
  });

  it("cancelScheduleGeneration is a no-op when nothing is running", async () => {
    const { cancelScheduleGeneration } = await import("./scheduleWorkerClient");
    expect(() => cancelScheduleGeneration()).not.toThrow();
  });
});
