import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { generateRandomSeed } from "@uoplan/core";
import { normalizeBlockedTimes } from "../../lib/blockedTimes";

interface ConstraintsSlice {
  setGenerationMinStartMinutes: AppStore["setGenerationMinStartMinutes"];
  setGenerationMaxEndMinutes: AppStore["setGenerationMaxEndMinutes"];
  setGenerationAllowedDays: AppStore["setGenerationAllowedDays"];
  setGenerationMinProfessorRating: AppStore["setGenerationMinProfessorRating"];
  setIncludeClosedComponents: AppStore["setIncludeClosedComponents"];
  setVirtualSectionsOnly: AppStore["setVirtualSectionsOnly"];
  setGenerationLimitFirstYearCredits: AppStore["setGenerationLimitFirstYearCredits"];
  setGenerationCompressedSchedule: AppStore["setGenerationCompressedSchedule"];
  setGenerationPreferEasier: AppStore["setGenerationPreferEasier"];
  setBlacklistedCourses: AppStore["setBlacklistedCourses"];
  addBlockedTime: AppStore["addBlockedTime"];
  updateBlockedTime: AppStore["updateBlockedTime"];
  removeBlockedTime: AppStore["removeBlockedTime"];
}

export const createConstraintsSlice: StateCreator<AppStore, [], [], ConstraintsSlice> = (
  set,
  get,
) => ({
  setIncludeClosedComponents: (value) => {
    get().clearEnrollmentsCache();
    set({ includeClosedComponents: value });
  },

  setVirtualSectionsOnly: (value) => {
    get().clearEnrollmentsCache();
    set({ virtualSectionsOnly: value });
  },

  setGenerationMinStartMinutes: (minutes) => set({ generationMinStartMinutes: minutes }),

  setGenerationMaxEndMinutes: (minutes) => set({ generationMaxEndMinutes: minutes }),

  setGenerationAllowedDays: (days) => set({ generationAllowedDays: days }),

  setGenerationMinProfessorRating: (rating) =>
    set({
      generationMinProfessorRating: rating == null ? null : Number(rating),
    }),

  setGenerationLimitFirstYearCredits: (v) => set({ generationLimitFirstYearCredits: v }),

  setGenerationCompressedSchedule: (v) => set({ generationCompressedSchedule: v }),

  setGenerationPreferEasier: (v) => set({ generationPreferEasier: v }),

  setBlacklistedCourses: (courses) =>
    set({
      blacklistedCourses: courses,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    }),

  addBlockedTime: (window) => {
    const next = normalizeBlockedTimes([...get().blockedTimes, { id: "", ...window }]);
    set({
      blockedTimes: next,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    });
    void get().generateSchedules();
  },

  updateBlockedTime: (id, window) => {
    const next = normalizeBlockedTimes(
      get().blockedTimes.map((b) => (b.id === id ? { id, ...window } : b)),
    );
    set({
      blockedTimes: next,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    });
    void get().generateSchedules();
  },

  removeBlockedTime: (id) => {
    const next = get().blockedTimes.filter((b) => b.id !== id);
    if (next.length === get().blockedTimes.length) return;
    set({
      blockedTimes: normalizeBlockedTimes(next),
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    });
    void get().generateSchedules();
  },
});
