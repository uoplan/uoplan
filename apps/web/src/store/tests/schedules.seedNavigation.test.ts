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

describe("schedules seed navigation", () => {
  const firstSeed = 1_000_000_000;

  beforeEach(() => {
    resetStoreForSeedTests(generateSchedulesActionMock, firstSeed);
  });

  function expectGenerateCalledWithSeed(seed: number) {
    expect(generateSchedulesActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentSeed: seed }),
      expect.any(String),
    );
  }

  function expectAtFirstSeed() {
    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
    expect(
      canGoToPreviousSeed(
        defaultAppStore.getState().currentSeed,
        defaultAppStore.getState().lowestVisitedSeed,
      ),
    ).toBe(false);
    expect(defaultAppStore.getState().lowestVisitedSeed).toBe(firstSeed);
  }

  async function goToNextSeedAndExpectFirstSeed() {
    await defaultAppStore.getState().goToNextSeed();

    expectAtFirstSeed();
    expectGenerateCalledWithSeed(firstSeed);
  }

  it("goToNextSeed from 0 uses firstSeed", async () => {
    await goToNextSeedAndExpectFirstSeed();
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
    expectGenerateCalledWithSeed(firstSeed);
  });

  it("goToNextSeed from corrupt seed lands on firstSeed (not firstSeed+1)", async () => {
    defaultAppStore.setState({ currentSeed: 3 });
    await goToNextSeedAndExpectFirstSeed();
  });

  it("generateSchedules repairs corrupt seed before generating", async () => {
    defaultAppStore.setState({ currentSeed: 3 });
    await defaultAppStore.getState().generateSchedules();

    expect(defaultAppStore.getState().currentSeed).toBe(firstSeed);
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
    resetStoreForSeedTests(generateSchedulesActionMock, firstSeed, {
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
    generateSchedulesActionMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: scheduleWithSection("B"),
    });

    await defaultAppStore.getState().goToNextSeed();

    expect(defaultAppStore.getState().scheduleNoVariety).toBe(false);
    expect(generateSchedulesActionMock).toHaveBeenCalledTimes(1);
    expect(
      defaultAppStore.getState().currentSchedule?.enrollments[0].sectionCombo.LEC.section.section,
    ).toBe("B");
  });

  it("still reports no variety when every candidate is the identical timetable", async () => {
    generateSchedulesActionMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: scheduleWithSection("A"),
    });

    await defaultAppStore.getState().goToNextSeed();

    expect(defaultAppStore.getState().scheduleNoVariety).toBe(true);
    expect(generateSchedulesActionMock).toHaveBeenCalledTimes(30);
  });

  it("keeps the current schedule and seed when a seed-nav generation fails", async () => {
    generateSchedulesActionMock.mockResolvedValue({
      ...emptyScheduleGenerationResult(),
      currentSchedule: null,
      generationError: { message: { kind: "lead", lead: "no-courses" }, details: null },
    });

    await defaultAppStore.getState().goToNextSeed();

    const state = defaultAppStore.getState();
    expect(state.currentSchedule?.enrollments[0].sectionCombo.LEC.section.section).toBe("A");
    expect(state.currentSeed).toBe(firstSeed);
    expect(state.generationError).not.toBeNull();
  });
});
