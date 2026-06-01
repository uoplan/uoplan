import { describe, it, expect, beforeEach, vi } from "vitest";
import { defaultAppStore } from "../appStore";

const generateSchedulesActionMock = vi.fn();

vi.mock("../../workers/scheduleWorkerClient", () => ({
  runScheduleGeneration: (...args: unknown[]) => generateSchedulesActionMock(...args),
  prewarmScheduleWorker: vi.fn().mockResolvedValue(undefined),
  dataKeyFromState: () => null,
  inputFromState: (s: unknown) => s,
}));

const mockResult = {
  currentSchedule: { enrollments: [] },
  swapPool: [],
  chosenCourseToRequirementId: {},
  currentPoolMap: {},
  currentColorMap: {},
  generationError: null,
};

describe("generationOptionsDirty", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    generateSchedulesActionMock.mockReset();
    generateSchedulesActionMock.mockResolvedValue(mockResult);
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      calendarMode: "basic",
      firstSeed,
      currentSeed: 0,
      lowestVisitedSeed: null,
      currentSchedule: null,
      scheduleGenerating: false,
      currentSwaps: [],
      blockedTimes: [],
      generationOptionsDirty: false,
    });
  });

  it("addBlockedTime marks options dirty without auto-generating", () => {
    defaultAppStore.getState().addBlockedTime({
      day: "Mo",
      startMinutes: 600,
      endMinutes: 720,
    });

    expect(defaultAppStore.getState().generationOptionsDirty).toBe(true);
    expect(defaultAppStore.getState().blockedTimes).toHaveLength(1);
    expect(generateSchedulesActionMock).not.toHaveBeenCalled();
  });

  it("changing a generation option marks dirty", () => {
    defaultAppStore.getState().setGenerationMinStartMinutes(540);
    expect(defaultAppStore.getState().generationOptionsDirty).toBe(true);
    expect(generateSchedulesActionMock).not.toHaveBeenCalled();
  });

  it("generating a schedule clears the dirty flag", async () => {
    defaultAppStore.getState().addBlockedTime({
      day: "Mo",
      startMinutes: 600,
      endMinutes: 720,
    });
    expect(defaultAppStore.getState().generationOptionsDirty).toBe(true);

    await defaultAppStore.getState().goToNextSeed();

    expect(defaultAppStore.getState().generationOptionsDirty).toBe(false);
    expect(generateSchedulesActionMock).toHaveBeenCalled();
  });
});
