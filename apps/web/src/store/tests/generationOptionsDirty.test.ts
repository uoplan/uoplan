import { describe, it, expect, beforeEach, vi } from "vitest";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
import { defaultAppStore } from "../appStore";
import { emptyScheduleGenerationResult, resetStoreForSeedTests } from "./scheduleTestHelpers";

const generateSchedulesActionMock = vi.fn();

vi.mock("../../workers/scheduleWorkerClient", () => ({
  runScheduleGeneration: (...args: unknown[]) => generateSchedulesActionMock(...args),
  prewarmScheduleWorker: vi.fn().mockResolvedValue(undefined),
  dataKeyFromState: () => null,
  inputFromState: (s: unknown) => s,
}));

describe("generationOptionsDirty", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    resetStoreForSeedTests(generateSchedulesActionMock, firstSeed, {
      calendarMode: "basic",
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

  it("clears the dirty flag at the start of a run so mid-run option changes can cancel", async () => {
    // Start already-dirty (e.g. options changed, then the user clicked Generate).
    defaultAppStore.getState().setGenerationMinStartMinutes(540);
    expect(defaultAppStore.getState().generationOptionsDirty).toBe(true);

    // Capture the dirty flag at the moment generation is actually running. The
    // CalendarPage cancel subscription relies on a false -> true transition, so
    // the flag must already be false once the run is in flight.
    let dirtyWhileRunning: boolean | null = null;
    generateSchedulesActionMock.mockImplementation(() => {
      dirtyWhileRunning = defaultAppStore.getState().generationOptionsDirty;
      expect(defaultAppStore.getState().scheduleGenerating).toBe(true);
      return Promise.resolve(emptyScheduleGenerationResult());
    });

    await defaultAppStore.getState().generateBasicSchedules();

    expect(dirtyWhileRunning).toBe(false);
  });

  it("randomizeSeed resets the seed ladder so Previous is disabled", async () => {
    // Simulate having navigated forward a few variants before changing options.
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      currentSeed: firstSeed + 3,
      lowestVisitedSeed: firstSeed,
      generationOptionsDirty: true,
    });
    expect(canGoToPreviousSeed(firstSeed + 3, defaultAppStore.getState().lowestVisitedSeed)).toBe(
      true,
    );

    await defaultAppStore.getState().randomizeSeed();

    const state = defaultAppStore.getState();
    expect(state.lowestVisitedSeed).toBe(state.currentSeed);
    expect(canGoToPreviousSeed(state.currentSeed, state.lowestVisitedSeed)).toBe(false);
    expect(state.generationOptionsDirty).toBe(false);
  });
});
