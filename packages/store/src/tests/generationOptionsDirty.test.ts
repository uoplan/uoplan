import { beforeEach, describe, expect, it } from "vitest";
import { canGoToPreviousSeed } from "../seedNavigation";
import { emptyScheduleGenerationResult } from "./scheduleBuilders";
import {
  resetStoreForSeedTests,
  runScheduleGenerationMock,
  testStore,
} from "./scheduleStoreHelpers";

describe("generationOptionsDirty", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    resetStoreForSeedTests(firstSeed, {
      calendarMode: "basic",
      blockedTimes: [],
      generationOptionsDirty: false,
    });
  });

  it("addBlockedTime marks options dirty without auto-generating", () => {
    testStore.getState().addBlockedTime({
      day: "Mo",
      startMinutes: 600,
      endMinutes: 720,
    });

    expect(testStore.getState().generationOptionsDirty).toBe(true);
    expect(testStore.getState().blockedTimes).toHaveLength(1);
    expect(runScheduleGenerationMock).not.toHaveBeenCalled();
  });

  it("changing a generation option marks dirty", () => {
    testStore.getState().setGenerationMinStartMinutes(540);
    expect(testStore.getState().generationOptionsDirty).toBe(true);
    expect(runScheduleGenerationMock).not.toHaveBeenCalled();
  });

  it("generating a schedule clears the dirty flag", async () => {
    testStore.getState().addBlockedTime({
      day: "Mo",
      startMinutes: 600,
      endMinutes: 720,
    });
    expect(testStore.getState().generationOptionsDirty).toBe(true);

    await testStore.getState().goToNextSeed();

    expect(testStore.getState().generationOptionsDirty).toBe(false);
    expect(runScheduleGenerationMock).toHaveBeenCalled();
  });

  it("clears the dirty flag at the start of a run so mid-run option changes can cancel", async () => {
    // Start already-dirty (e.g. options changed, then the user clicked Generate).
    testStore.getState().setGenerationMinStartMinutes(540);
    expect(testStore.getState().generationOptionsDirty).toBe(true);

    // Capture the dirty flag at the moment generation is actually running. The
    // CalendarPage cancel subscription relies on a false -> true transition, so
    // the flag must already be false once the run is in flight.
    let dirtyWhileRunning: boolean | null = null;
    runScheduleGenerationMock.mockImplementation(() => {
      dirtyWhileRunning = testStore.getState().generationOptionsDirty;
      expect(testStore.getState().scheduleGenerating).toBe(true);
      return Promise.resolve(emptyScheduleGenerationResult());
    });

    await testStore.getState().generateBasicSchedules();

    expect(dirtyWhileRunning).toBe(false);
  });

  it("randomizeSeed resets the seed ladder so Previous is disabled", async () => {
    // Simulate having navigated forward a few variants before changing options.
    testStore.setState({
      ...testStore.getState(),
      currentSeed: firstSeed + 3,
      lowestVisitedSeed: firstSeed,
      generationOptionsDirty: true,
    });
    expect(canGoToPreviousSeed(firstSeed + 3, testStore.getState().lowestVisitedSeed)).toBe(true);

    await testStore.getState().randomizeSeed();

    const state = testStore.getState();
    expect(state.lowestVisitedSeed).toBe(state.currentSeed);
    expect(canGoToPreviousSeed(state.currentSeed, state.lowestVisitedSeed)).toBe(false);
    expect(state.generationOptionsDirty).toBe(false);
  });
});
