import { beforeEach, describe, expect, it } from "vitest";
import { canGoToPreviousSeed } from "../seedNavigation";
import { emptyScheduleGenerationResult } from "./scheduleBuilders";
import {
  resetStoreForSeedTests,
  runScheduleGenerationMock,
  testStore,
} from "./scheduleStoreHelpers";

describe("schedules seed navigation", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    resetStoreForSeedTests(firstSeed);
  });

  function expectGenerateCalledWithSeed(seed: number) {
    expect(runScheduleGenerationMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: seed }),
      expect.any(String),
    );
  }

  function expectAtFirstSeed() {
    expect(testStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(testStore.getState().currentSeed, testStore.getState().lowestVisitedSeed),
    ).toBe(false);
    expect(testStore.getState().lowestVisitedSeed).toBe(firstSeed);
  }

  async function goToNextSeedAndExpectFirstSeed() {
    await testStore.getState().goToNextSeed();

    expectAtFirstSeed();
    expectGenerateCalledWithSeed(firstSeed);
  }

  it("goToNextSeed from 0 uses firstSeed", async () => {
    await goToNextSeedAndExpectFirstSeed();
  });

  it("second goToNextSeed enables previous navigation", async () => {
    await testStore.getState().goToNextSeed();
    await testStore.getState().goToNextSeed();

    const { currentSeed } = testStore.getState();
    expect(currentSeed).toBeGreaterThan(firstSeed);
    expect(canGoToPreviousSeed(currentSeed, testStore.getState().lowestVisitedSeed)).toBe(true);
    expect(testStore.getState().lowestVisitedSeed).toBe(firstSeed);
  });

  it("goToPreviousSeed decrements from firstSeed + 1", async () => {
    testStore.setState({ currentSeed: firstSeed + 1 });
    await testStore.getState().goToPreviousSeed();

    expect(testStore.getState().currentSeed).toBe(firstSeed);
    expectGenerateCalledWithSeed(firstSeed);
  });

  it("goToNextSeed from corrupt seed lands on firstSeed (not firstSeed+1)", async () => {
    testStore.setState({ currentSeed: 3 });
    await goToNextSeedAndExpectFirstSeed();
  });

  it("generateSchedules repairs corrupt seed before generating", async () => {
    testStore.setState({ currentSeed: 3 });
    await testStore.getState().generateSchedules();

    expect(testStore.getState().currentSeed).toBe(firstSeed);
    expectGenerateCalledWithSeed(firstSeed);
  });
});

/** Build a one-course schedule whose timetable fingerprint depends on `section`. */
function scheduleWithSection(section: string) {
  return {
    enrollments: [
      {
        courseCode: "AAA 1000",
        sectionCombo: { LEC: { section: { section } } },
        times: [{ day: "Mo", startMinutes: 540, endMinutes: 600 }],
      },
    ],
  };
}

describe("schedules navigation variety detection (full timetable fingerprint)", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    resetStoreForSeedTests(firstSeed, {
      currentSeed: firstSeed,
      lowestVisitedSeed: firstSeed,
      currentSchedule: scheduleWithSection("A") as never,
      scheduleGenerating: false,
      scheduleNoVariety: false,
      swapsPerSeed: {},
      calendarMode: "advanced",
    });
  });

  it("accepts a same-course-set schedule with different section/times as real variety", async () => {
    // Same course "AAA 1000" but a different section than the current schedule:
    // a course-code-only fingerprint would wrongly call this "no variety".
    runScheduleGenerationMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: scheduleWithSection("B"),
    });

    await testStore.getState().goToNextSeed();

    expect(testStore.getState().scheduleNoVariety).toBe(false);
    expect(runScheduleGenerationMock).toHaveBeenCalledTimes(1);
    expect(
      testStore.getState().currentSchedule?.enrollments[0].sectionCombo.LEC.section.section,
    ).toBe("B");
  });

  it("still reports no variety when every candidate is the identical timetable", async () => {
    runScheduleGenerationMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: scheduleWithSection("A"),
    });

    await testStore.getState().goToNextSeed();

    expect(testStore.getState().scheduleNoVariety).toBe(true);
    expect(runScheduleGenerationMock).toHaveBeenCalledTimes(30);
  });

  it("keeps the current schedule and seed when a seed-nav generation fails", async () => {
    runScheduleGenerationMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: null,
      generationError: { message: { kind: "lead", lead: "no-courses" }, details: null },
    });

    await testStore.getState().goToNextSeed();

    const state = testStore.getState();
    expect(state.currentSchedule?.enrollments[0].sectionCombo.LEC.section.section).toBe("A");
    expect(state.currentSeed).toBe(firstSeed);
    expect(state.generationError).not.toBeNull();
  });
});
