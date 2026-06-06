import type { StateCreator } from "zustand";
import type { AppStore } from "../../types";
import { arrangementFingerprint, type GeneratedSchedule } from "@uoplan/core";
import { flushPersistedAppState } from "../../../lib/persistAppState";
import { noteLowestVisitedSeed } from "../../../lib/seedNavigation";
import type { ScheduleGenerationResult, SchedulesSlice } from "./types";

/**
 * Identifies a timetable by its full course + section/time arrangement, not just
 * its course set. The generator now produces genuinely different section/time
 * arrangements for the same courses (the randomness fix), so deduping by course
 * code alone would collapse that variety and falsely report "no more schedules".
 */
export function scheduleFingerprint(schedule: GeneratedSchedule): string {
  return arrangementFingerprint(schedule);
}

export function applyScheduleGenerationResult(
  set: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[0],
  get: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[1],
  result: ScheduleGenerationResult,
  seed: number,
) {
  const lowestVisitedSeed = noteLowestVisitedSeed(get().lowestVisitedSeed, seed);
  set({
    ...result,
    currentSeed: seed,
    lowestVisitedSeed,
    calendarWeekIndex: null,
    scheduleNoVariety: false,
    generationOptionsDirty: false,
  });
}

export async function withScheduleGenerating(
  set: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[0],
  run: () => Promise<void>,
) {
  // Clear the dirty flag as the run begins so that any generation-option change
  // made while this run is in flight is a genuine `false -> true` transition. The
  // CalendarPage subscription keys off that transition to cancel the in-flight
  // run; without the reset, a run started while already-dirty could never be
  // cancelled and would hang until the hard timeout.
  set({ scheduleGenerating: true, generationOptionsDirty: false });
  try {
    await run();
  } finally {
    set({ scheduleGenerating: false });
    flushPersistedAppState();
  }
}
