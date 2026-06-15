import type { AppStore } from "../../types";

export type ScheduleGenerationResult = {
  currentSchedule: AppStore["currentSchedule"];
  swapPool: string[];
  chosenCourseToRequirementId: Record<string, string>;
  currentPoolMap: Record<string, string>;
  currentColorMap: Record<string, number>;
  generationError: AppStore["generationError"];
};

export interface SchedulesSlice {
  generateSchedules: AppStore["generateSchedules"];
  generateBasicSchedules: AppStore["generateBasicSchedules"];
  clearSchedule: AppStore["clearSchedule"];
  resetBasicCalendarSettings: AppStore["resetBasicCalendarSettings"];
  markBasicSettingsChanged: AppStore["markBasicSettingsChanged"];
  goToPreviousSeed: AppStore["goToPreviousSeed"];
  goToNextSeed: AppStore["goToNextSeed"];
  randomizeSeed: AppStore["randomizeSeed"];
  swapCourseInSchedule: AppStore["swapCourseInSchedule"];
  undoLastSwap: AppStore["undoLastSwap"];
  getSwapCandidates: AppStore["getSwapCandidates"];
  lockCourseForAllSchedulesFromSwap: AppStore["lockCourseForAllSchedulesFromSwap"];
  unlockCourseForAllSchedulesFromSwap: AppStore["unlockCourseForAllSchedulesFromSwap"];
  blacklistCourseFromSwap: AppStore["blacklistCourseFromSwap"];
  unblacklistCourseFromSwap: AppStore["unblacklistCourseFromSwap"];
  importSchedule: AppStore["importSchedule"];
  clearEnrollmentsCache: AppStore["clearEnrollmentsCache"];
}
