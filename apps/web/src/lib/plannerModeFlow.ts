import type { StateCreator } from "zustand";
import type { AppStore } from "../store/types";
import { recomputeStateForProgram } from "../store/requirementCompute";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
} from "./electiveEligibility";

type SetState = Parameters<StateCreator<AppStore, [], [], unknown>>[0];
type GetState = Parameters<StateCreator<AppStore, [], [], unknown>>[1];

function hasUntouchedDefaultBuckets(state: AppStore): boolean {
  return (
    state.levelBuckets.length === 1 &&
    state.levelBuckets[0] === "undergrad" &&
    state.languageBuckets.length === 2 &&
    state.languageBuckets.includes("en") &&
    state.languageBuckets.includes("other") &&
    state.electiveLevelBuckets.length === 2 &&
    state.electiveLevelBuckets.includes(1000) &&
    state.electiveLevelBuckets.includes(2000)
  );
}

/** Apply basic calendar bucket defaults when the user still has generic undergrad defaults. */
export function applyBasicDefaultsIfUntouched(set: SetState, get: GetState): void {
  const state = get();
  if (!hasUntouchedDefaultBuckets(state)) return;
  set({
    levelBuckets: [...DEFAULT_BASIC_LEVEL_BUCKETS],
    languageBuckets: [...DEFAULT_BASIC_LANGUAGE_BUCKETS],
    electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
  });
}

/** Refresh requirement state when entering the advanced wizard (no wizardMode write). */
export function enterAdvancedWizardFlow(set: SetState, get: GetState): void {
  const {
    program,
    minorProgram,
    cache,
    completedCourses,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    levelBuckets,
    languageBuckets,
    includeClosedComponents,
    studentPrograms,
    requirementSlotsUserTouched,
  } = get();
  if (!program || !cache) return;
  set(
    recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    ),
  );
}
