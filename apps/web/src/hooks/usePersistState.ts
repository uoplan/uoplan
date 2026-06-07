import { useEffect, useRef } from "react";
import { flushPersistedAppState } from "../lib/persistAppState";
import { useAppStore, useAppStoreApi } from "../store/appStore";
import type { AppStore } from "../store/types";

const DEBOUNCE_MS = 400;

function hasPersistedStateChange(next: AppStore, prev: AppStore): boolean {
  return (
    next.catalogue !== prev.catalogue ||
    next.indices !== prev.indices ||
    next.selectedTermId !== prev.selectedTermId ||
    next.firstYear !== prev.firstYear ||
    next.program !== prev.program ||
    next.completedCourses !== prev.completedCourses ||
    next.levelBuckets !== prev.levelBuckets ||
    next.languageBuckets !== prev.languageBuckets ||
    next.electiveLevelBuckets !== prev.electiveLevelBuckets ||
    next.coursesThisSemester !== prev.coursesThisSemester ||
    next.firstSeed !== prev.firstSeed ||
    next.currentSeed !== prev.currentSeed ||
    next.currentSwaps !== prev.currentSwaps ||
    next.selectedPerRequirement !== prev.selectedPerRequirement ||
    next.selectedOptionsPerRequirement !== prev.selectedOptionsPerRequirement ||
    next.constrainedPerRequirement !== prev.constrainedPerRequirement ||
    next.requirementTreeWithStatus !== prev.requirementTreeWithStatus ||
    next.remainingRequirements !== prev.remainingRequirements ||
    next.includeClosedComponents !== prev.includeClosedComponents ||
    next.virtualSectionsOnly !== prev.virtualSectionsOnly ||
    next.studentPrograms !== prev.studentPrograms ||
    next.frenchImmersionStream !== prev.frenchImmersionStream ||
    next.basicPinnedCourses !== prev.basicPinnedCourses ||
    next.basicElectivesCount !== prev.basicElectivesCount ||
    next.basicExcludedCategories !== prev.basicExcludedCategories ||
    next.generationMinStartMinutes !== prev.generationMinStartMinutes ||
    next.generationMaxEndMinutes !== prev.generationMaxEndMinutes ||
    next.generationMinProfessorRating !== prev.generationMinProfessorRating ||
    next.generationLimitFirstYearCredits !== prev.generationLimitFirstYearCredits ||
    next.generationCompressedSchedule !== prev.generationCompressedSchedule ||
    next.generationPreferEasier !== prev.generationPreferEasier ||
    next.generationPreferHigherSentiment !== prev.generationPreferHigherSentiment ||
    next.blacklistedCourses !== prev.blacklistedCourses ||
    next.blockedTimes !== prev.blockedTimes ||
    next.requirementSlotsUserTouched !== prev.requirementSlotsUserTouched ||
    next.calendarWeekIndex !== prev.calendarWeekIndex
  );
}

export { hasPersistedStateChange };

/**
 * Subscribes to the app store and debounce-saves encoded state to localStorage
 * whenever it changes. Pass `enabled` as false until the data needed for encoding
 * is ready (e.g. wait for `indices` to be loaded).
 */
export function usePersistState(enabled: boolean): void {
  const getEncodedStateBase64 = useAppStore((s) => s.getEncodedStateBase64);
  const storeApi = useAppStoreApi();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      flushPersistedAppState();
    };

    const schedule = (state: AppStore, prevState: AppStore) => {
      if (!hasPersistedStateChange(state, prevState)) return;
      storeApi.setState({ hasPendingSave: true });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    };

    const unsub = storeApi.subscribe(schedule);

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, getEncodedStateBase64, storeApi]);
}
