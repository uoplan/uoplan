import { describe, it, expect, beforeEach, vi } from "vitest";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
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

describe("schedules seed navigation", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    generateSchedulesActionMock.mockReset();
    generateSchedulesActionMock.mockResolvedValue(mockResult);
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      firstSeed,
      currentSeed: 0,
      lowestVisitedSeed: null,
      currentSchedule: null,
      scheduleGenerating: false,
      currentSwaps: [],
    });
  });

  it("goToNextSeed from 0 uses firstSeed", async () => {
    await defaultAppStore.getState().goToNextSeed();

    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(
        defaultAppStore.getState().currentSeed,
        defaultAppStore.getState().lowestVisitedSeed,
      ),
    ).toBe(false);
    expect(defaultAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
      expect.any(String),
    );
  });

  it("second goToNextSeed enables previous navigation", async () => {
    await defaultAppStore.getState().goToNextSeed();
    await defaultAppStore.getState().goToNextSeed();

    const { currentSeed } = defaultAppStore.getState();
    expect(currentSeed).toBeGreaterThan(firstSeed);
    expect(canGoToPreviousSeed(currentSeed, defaultAppStore.getState().lowestVisitedSeed)).toBe(
      true,
    );
    expect(defaultAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
  });

  it("goToPreviousSeed decrements from firstSeed + 1", async () => {
    defaultAppStore.setState({ currentSeed: firstSeed + 1 });
    await defaultAppStore.getState().goToPreviousSeed();

    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
      expect.any(String),
    );
  });

  it("goToNextSeed from corrupt seed lands on firstSeed (not firstSeed+1)", async () => {
    defaultAppStore.setState({ currentSeed: 3 });
    await defaultAppStore.getState().goToNextSeed();

    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(
        defaultAppStore.getState().currentSeed,
        defaultAppStore.getState().lowestVisitedSeed,
      ),
    ).toBe(false);
    expect(defaultAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
      expect.any(String),
    );
  });

  it("generateSchedules repairs corrupt seed before generating", async () => {
    defaultAppStore.setState({ currentSeed: 3 });
    await defaultAppStore.getState().generateSchedules();

    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
      expect.any(String),
    );
  });
});
