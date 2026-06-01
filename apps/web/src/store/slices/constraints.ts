import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { normalizeBlockedTimes, reconcileAvoidedDays } from "../../lib/blockedTimes";

interface ConstraintsSlice {
  setGenerationMinStartMinutes: AppStore["setGenerationMinStartMinutes"];
  setGenerationMaxEndMinutes: AppStore["setGenerationMaxEndMinutes"];
  setAvoidedDays: AppStore["setAvoidedDays"];
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
    set({ includeClosedComponents: value, generationOptionsDirty: true });
  },

  setVirtualSectionsOnly: (value) => {
    get().clearEnrollmentsCache();
    set({ virtualSectionsOnly: value, generationOptionsDirty: true });
  },

  setGenerationMinStartMinutes: (minutes) =>
    set({ generationMinStartMinutes: minutes, generationOptionsDirty: true }),

  setGenerationMaxEndMinutes: (minutes) =>
    set({ generationMaxEndMinutes: minutes, generationOptionsDirty: true }),

  setAvoidedDays: (days) => {
    const next = reconcileAvoidedDays(get().blockedTimes, days);
    set({ blockedTimes: next, generationOptionsDirty: true });
  },

  setGenerationMinProfessorRating: (rating) =>
    set({
      generationMinProfessorRating: rating == null ? null : Number(rating),
      generationOptionsDirty: true,
    }),

  setGenerationLimitFirstYearCredits: (v) =>
    set({ generationLimitFirstYearCredits: v, generationOptionsDirty: true }),

  setGenerationCompressedSchedule: (v) =>
    set({ generationCompressedSchedule: v, generationOptionsDirty: true }),

  setGenerationPreferEasier: (v) =>
    set({ generationPreferEasier: v, generationOptionsDirty: true }),

  setBlacklistedCourses: (courses) =>
    set({ blacklistedCourses: courses, generationOptionsDirty: true }),

  addBlockedTime: (window) => {
    const next = normalizeBlockedTimes([...get().blockedTimes, { id: "", ...window }]);
    set({ blockedTimes: next, generationOptionsDirty: true });
  },

  updateBlockedTime: (id, window) => {
    const next = normalizeBlockedTimes(
      get().blockedTimes.map((b) => (b.id === id ? { id, ...window } : b)),
    );
    set({ blockedTimes: next, generationOptionsDirty: true });
  },

  removeBlockedTime: (id) => {
    const next = get().blockedTimes.filter((b) => b.id !== id);
    if (next.length === get().blockedTimes.length) return;
    set({ blockedTimes: normalizeBlockedTimes(next), generationOptionsDirty: true });
  },
});
