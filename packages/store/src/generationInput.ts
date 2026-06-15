import type { AppState } from "./types";
import type { GenerateSchedulesMode } from "./services";

/**
 * Lightweight schedule-generation input types and the `AppState` → input
 * projection, split out from `generateSchedulesAction` so the main-thread
 * worker client can build the input without statically importing the heavy
 * `@uoplan/core` generation runners (which would drag them onto the initial
 * critical path). The actual generation action is loaded lazily / in the worker.
 */

/**
 * Subset of {@link AppState} fields the generator reads. Pick<> keeps this in
 * lock-step with AppState so adding a new field to the action automatically
 * propagates a compile error here.
 */
export type GenerateSchedulesInput = Pick<
  AppState,
  | "basketCourses"
  | "basicElectivesCount"
  | "basicExcludedCategories"
  | "completedCourses"
  | "studentPrograms"
  | "program"
  | "remainingRequirements"
  | "requirementTreeWithStatus"
  | "selectedPerRequirement"
  | "selectedOptionsPerRequirement"
  | "constrainedPerRequirement"
  | "requirementPriorities"
  | "coursesThisSemester"
  | "prereqEligibleCourses"
  | "unassignedCompletedCourses"
  | "levelBuckets"
  | "languageBuckets"
  | "electiveLevelBuckets"
  | "generationMinStartMinutes"
  | "generationMaxEndMinutes"
  | "generationMinProfessorRating"
  | "professorRatings"
  | "currentSeed"
  | "firstSeed"
  | "includeClosedComponents"
  | "virtualSectionsOnly"
  | "generationLimitFirstYearCredits"
  | "generationCompressedSchedule"
  | "generationPreferEasier"
  | "generationPreferHigherSentiment"
  | "courseSentimentByNorm"
  | "frenchImmersionStream"
  | "blacklistedCourses"
  | "blockedTimes"
> & {
  /** Set explicitly by callers instead of read from module-global state. */
  mode: GenerateSchedulesMode;
};

/** Extract the worker-safe input from an AppState snapshot. */
export function pickGenerateSchedulesInput(
  state: AppState,
  mode: GenerateSchedulesMode,
): GenerateSchedulesInput {
  return {
    mode,
    basketCourses: state.basketCourses,
    basicElectivesCount: state.basicElectivesCount,
    basicExcludedCategories: state.basicExcludedCategories,
    completedCourses: state.completedCourses,
    studentPrograms: state.studentPrograms,
    program: state.program,
    remainingRequirements: state.remainingRequirements,
    requirementTreeWithStatus: state.requirementTreeWithStatus,
    selectedPerRequirement: state.selectedPerRequirement,
    selectedOptionsPerRequirement: state.selectedOptionsPerRequirement,
    constrainedPerRequirement: state.constrainedPerRequirement,
    requirementPriorities: state.requirementPriorities,
    coursesThisSemester: state.coursesThisSemester,
    prereqEligibleCourses: state.prereqEligibleCourses,
    unassignedCompletedCourses: state.unassignedCompletedCourses,
    levelBuckets: state.levelBuckets,
    languageBuckets: state.languageBuckets,
    electiveLevelBuckets: state.electiveLevelBuckets,
    generationMinStartMinutes: state.generationMinStartMinutes,
    generationMaxEndMinutes: state.generationMaxEndMinutes,
    generationMinProfessorRating: state.generationMinProfessorRating,
    professorRatings: state.professorRatings,
    currentSeed: state.currentSeed,
    firstSeed: state.firstSeed,
    includeClosedComponents: state.includeClosedComponents,
    virtualSectionsOnly: state.virtualSectionsOnly,
    generationLimitFirstYearCredits: state.generationLimitFirstYearCredits,
    generationCompressedSchedule: state.generationCompressedSchedule,
    generationPreferEasier: state.generationPreferEasier,
    generationPreferHigherSentiment: state.generationPreferHigherSentiment,
    courseSentimentByNorm: state.courseSentimentByNorm,
    frenchImmersionStream: state.frenchImmersionStream,
    blacklistedCourses: state.blacklistedCourses,
    blockedTimes: state.blockedTimes,
  };
}
