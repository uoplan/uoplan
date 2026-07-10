import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppState } from "@uoplan/store/types";
import type { GenerateSchedulesResult } from "../generateSchedulesAction";
import { runPlanner } from "./runPlanner";

const capturedCompleted: Record<string, string[]> = {};
const capturedForced: Record<string, string[]> = {};
const capturedSeed: Record<string, number | undefined> = {};

// Avoid pulling in the real requirement recompute / AppState projection: capture
// the effective completed set the runner threads into each term.
vi.mock("./buildTermInput", () => ({
  buildPlannerTermInput: (
    _base: AppState,
    effectiveCompleted: string[],
    count: number,
    forcedCourses: string[] = [],
    seed?: number,
  ) => ({
    completedCourses: effectiveCompleted,
    coursesThisSemester: count,
    basketCourses: forcedCourses,
    currentSeed: seed,
  }),
  plannerTermDataKey: (_base: AppState, termId: string) => ({
    termId,
    firstYear: null,
    completedCourses: [],
  }),
}));

// Fake worker: each term "picks" two synthetic courses so we can assert both the
// threading-forward behaviour and the status classification.
const workerImpl = vi.fn();
vi.mock("../../workers/plannerWorkerClient", () => ({
  generatePlannerTermViaWorker: (
    dataKey: { termId: string },
    input: { completedCourses: string[]; basketCourses?: string[]; currentSeed?: number },
  ) => {
    capturedForced[dataKey.termId] = input.basketCourses ?? [];
    capturedSeed[dataKey.termId] = input.currentSeed;
    return workerImpl(dataKey, input);
  },
}));

function scheduleWith(courses: string[]): GenerateSchedulesResult {
  return {
    currentSchedule: { enrollments: courses.map((c) => ({ courseCode: c }) as never) },
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
  };
}

const base = {} as AppState;
const config = { enabledTermIds: ["2265", "2269"], countByTermId: {}, defaultCount: 2 };

describe("runPlanner", () => {
  beforeEach(() => {
    workerImpl.mockReset();
    for (const k of Object.keys(capturedCompleted)) delete capturedCompleted[k];
    for (const k of Object.keys(capturedForced)) delete capturedForced[k];
    for (const k of Object.keys(capturedSeed)) delete capturedSeed[k];
  });

  test("threads each term's picks forward as completed for later terms", async () => {
    workerImpl.mockImplementation(
      (dataKey: { termId: string }, input: { completedCourses: string[] }) => {
        capturedCompleted[dataKey.termId] = input.completedCourses;
        return scheduleWith([`${dataKey.termId}-A`, `${dataKey.termId}-B`]);
      },
    );

    const outcomes = await runPlanner(base, config, ["CSI 2110"]);

    expect(capturedCompleted["2265"]).toEqual(["CSI 2110"]);
    // The second term sees the base plus the first term's two picks.
    expect(capturedCompleted["2269"].sort()).toEqual(["2265-A", "2265-B", "CSI 2110"]);
    expect(outcomes.map((o) => o.status)).toEqual(["ok", "ok"]);
    expect(outcomes[0].courses).toEqual(["2265-A", "2265-B"]);
  });

  test("classifies partial / empty / error outcomes", async () => {
    workerImpl
      .mockResolvedValueOnce(scheduleWith(["2265-A"])) // 1 of 2 requested → partial
      .mockResolvedValueOnce(null); // worker failure → error

    const outcomes = await runPlanner(base, config, []);
    expect(outcomes.map((o) => o.status)).toEqual(["partial", "error"]);
  });

  test("empty schedule with an infeasible error is classified empty", async () => {
    workerImpl.mockResolvedValue({
      ...scheduleWith([]),
      currentSchedule: null,
      generationError: { message: { kind: "infeasible" }, details: null },
    });
    const outcomes = await runPlanner(base, { ...config, enabledTermIds: ["2265"] }, []);
    expect(outcomes[0].status).toBe("empty");
  });

  test("invokes onOutcome once per term in order", async () => {
    workerImpl.mockImplementation((dataKey: { termId: string }) =>
      scheduleWith([`${dataKey.termId}-A`, `${dataKey.termId}-B`]),
    );
    const seen: string[] = [];
    await runPlanner(base, config, [], (o) => seen.push(o.termId));
    expect(seen).toEqual(["2265", "2269"]);
  });

  test("surfaces the full result bundle on each outcome for calendar forwarding", async () => {
    workerImpl.mockImplementation((dataKey: { termId: string }) =>
      scheduleWith([`${dataKey.termId}-A`]),
    );
    const outcomes = await runPlanner(base, { ...config, enabledTermIds: ["2265"] }, []);
    expect(outcomes[0].result?.currentSchedule?.enrollments.map((e) => e.courseCode)).toEqual([
      "2265-A",
    ]);
  });

  test("a failed term surfaces a null result bundle", async () => {
    workerImpl.mockResolvedValue(null);
    const outcomes = await runPlanner(base, { ...config, enabledTermIds: ["2265"] }, []);
    expect(outcomes[0].result).toBeNull();
  });

  test("forwards each term's engine seed so regeneration varies the schedule", async () => {
    workerImpl.mockImplementation((dataKey: { termId: string }) =>
      scheduleWith([`${dataKey.termId}-A`]),
    );

    await runPlanner(base, { ...config, seedByTermId: { "2265": 42, "2269": 43 } }, []);

    expect(capturedSeed["2265"]).toBe(42);
    expect(capturedSeed["2269"]).toBe(43);
  });

  test("leaves the seed undefined when none is supplied (engine anchor default)", async () => {
    workerImpl.mockImplementation((dataKey: { termId: string }) =>
      scheduleWith([`${dataKey.termId}-A`]),
    );

    await runPlanner(base, { ...config, enabledTermIds: ["2265"] }, []);

    expect(capturedSeed["2265"]).toBeUndefined();
  });
});
