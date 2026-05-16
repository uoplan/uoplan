import { describe, it, expect, beforeEach, vi } from "vitest";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
import { useAppStore } from "../appStore";

const generateSchedulesActionMock = vi.fn();

vi.mock("../../lib/generateSchedulesAction", () => ({
  generateSchedulesAction: (...args: unknown[]) => generateSchedulesActionMock(...args),
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
    useAppStore.setState({
      ...useAppStore.getState(),
      firstSeed,
      currentSeed: 0,
      lowestVisitedSeed: null,
      currentSchedule: null,
      scheduleGenerating: false,
      currentSwaps: [],
    });
  });

  it("goToNextSeed from 0 uses firstSeed", async () => {
    await useAppStore.getState().goToNextSeed();

    expect(useAppStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(
        useAppStore.getState().currentSeed,
        useAppStore.getState().lowestVisitedSeed,
      ),
    ).toBe(false);
    expect(useAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
    );
  });

  it("second goToNextSeed enables previous navigation", async () => {
    await useAppStore.getState().goToNextSeed();
    await useAppStore.getState().goToNextSeed();

    const { currentSeed } = useAppStore.getState();
    expect(currentSeed).toBe(firstSeed + 1);
    expect(canGoToPreviousSeed(currentSeed, useAppStore.getState().lowestVisitedSeed)).toBe(true);
    expect(useAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
  });

  it("goToPreviousSeed decrements from firstSeed + 1", async () => {
    useAppStore.setState({ currentSeed: firstSeed + 1 });
    await useAppStore.getState().goToPreviousSeed();

    expect(useAppStore.getState().currentSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
    );
  });

  it("goToNextSeed from corrupt seed lands on firstSeed (not firstSeed+1)", async () => {
    useAppStore.setState({ currentSeed: 3 });
    await useAppStore.getState().goToNextSeed();

    expect(useAppStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(
        useAppStore.getState().currentSeed,
        useAppStore.getState().lowestVisitedSeed,
      ),
    ).toBe(false);
    expect(useAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
    );
  });

  it("generateSchedules repairs corrupt seed before generating", async () => {
    useAppStore.setState({ currentSeed: 3 });
    await useAppStore.getState().generateSchedules();

    expect(useAppStore.getState().currentSeed).toBe(firstSeed);
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: firstSeed }),
    );
  });
});
