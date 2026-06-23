import type { StateCreator } from "zustand";
import {
  reorderOptimizationPriorities as reorderPriorities,
  setGoodBreaksParams as setBreakParams,
  setOptimizationPriorityEnabled as setEnabled,
  toggleOptimizationPriority as togglePriority,
} from "@uoplan/core";
import type { AppStore } from "../types";
import { normalizeBlockedTimes, reconcileAvoidedDays } from "../blockedTimes";

interface ConstraintsSlice {
  setGenerationMinStartMinutes: AppStore["setGenerationMinStartMinutes"];
  setGenerationMaxEndMinutes: AppStore["setGenerationMaxEndMinutes"];
  setAvoidedDays: AppStore["setAvoidedDays"];
  setIncludeClosedComponents: AppStore["setIncludeClosedComponents"];
  setVirtualSectionsOnly: AppStore["setVirtualSectionsOnly"];
  setGenerationLimitFirstYearCredits: AppStore["setGenerationLimitFirstYearCredits"];
  setOptimizationPriorities: AppStore["setOptimizationPriorities"];
  reorderOptimizationPriorities: AppStore["reorderOptimizationPriorities"];
  setOptimizationPriorityEnabled: AppStore["setOptimizationPriorityEnabled"];
  toggleOptimizationPriority: AppStore["toggleOptimizationPriority"];
  setGoodBreaksParams: AppStore["setGoodBreaksParams"];
  setCourseSentimentByNorm: AppStore["setCourseSentimentByNorm"];
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

  setGenerationLimitFirstYearCredits: (v) =>
    set({ generationLimitFirstYearCredits: v, generationOptionsDirty: true }),

  setOptimizationPriorities: (list) =>
    set({ optimizationPriorities: list, generationOptionsDirty: true }),

  reorderOptimizationPriorities: (fromIndex, toIndex) =>
    set({
      optimizationPriorities: reorderPriorities(get().optimizationPriorities, fromIndex, toIndex),
      generationOptionsDirty: true,
    }),

  setOptimizationPriorityEnabled: (kind, enabled) =>
    set({
      optimizationPriorities: setEnabled(get().optimizationPriorities, kind, enabled),
      generationOptionsDirty: true,
    }),

  toggleOptimizationPriority: (kind) =>
    set({
      optimizationPriorities: togglePriority(get().optimizationPriorities, kind),
      generationOptionsDirty: true,
    }),

  setGoodBreaksParams: (params) =>
    set({
      optimizationPriorities: setBreakParams(get().optimizationPriorities, params),
      generationOptionsDirty: true,
    }),

  setCourseSentimentByNorm: (map) => set({ courseSentimentByNorm: map }),

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
