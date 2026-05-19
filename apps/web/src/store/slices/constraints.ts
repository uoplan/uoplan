import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { generateRandomSeed } from "schedule";
import { clearEnrollmentsCache } from "./schedules";

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
}

export const createConstraintsSlice: StateCreator<AppStore, [], [], ConstraintsSlice> = (set) => ({
  setIncludeClosedComponents: (value) => {
    clearEnrollmentsCache();
    set({ includeClosedComponents: value });
  },

  setVirtualSectionsOnly: (value) => {
    clearEnrollmentsCache();
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
});
