import { recomputeStateForProgram } from "@uoplan/store/requirementCompute";
import type { CacheDataKey } from "../dataCacheLoader";
import type { GenerateSchedulesInput } from "../generateSchedulesInput";
import { pickGenerateSchedulesInput } from "../generateSchedulesInput";
import type { AppState } from "../../store/types";

/**
 * Build the schedule-generation input for one hypothetical future term.
 *
 * The requirement state (remaining requirements, prereq-eligible courses, …) is
 * recomputed for `effectiveCompleted` — the base transcript plus everything the
 * earlier planned terms picked — so each term is generated as if the prior ones
 * were already completed. Everything else (constraints, optimization
 * priorities, professor ratings, blocked times) is inherited from the current
 * app state, which is how the calendar view's generation options "come over".
 */
export function buildPlannerTermInput(
  base: AppState,
  effectiveCompleted: string[],
  count: number,
  forcedCourses: string[] = [],
): GenerateSchedulesInput {
  const recomputed = recomputeStateForProgram(
    base.program,
    base.minorProgram,
    effectiveCompleted,
    base.cache,
    base.selectedPerRequirement,
    base.selectedOptionsPerRequirement,
    base.levelBuckets,
    base.languageBuckets,
    base.includeClosedComponents,
    base.studentPrograms,
    base.requirementSlotsUserTouched,
  );

  return {
    ...pickGenerateSchedulesInput(base, "advanced"),
    completedCourses: effectiveCompleted,
    coursesThisSemester: count,
    // Courses the student pinned to this term (from editing it in the calendar)
    // are forced; the generator fills the remaining slots toward requirements.
    // No extra electives carry over from the calendar view.
    additionalElectivesCount: 0,
    basketCourses: forcedCourses,
    remainingRequirements: recomputed.remainingRequirements,
    requirementTreeWithStatus: recomputed.requirementTreeWithStatus,
    selectedPerRequirement: recomputed.selectedPerRequirement,
    selectedOptionsPerRequirement: recomputed.selectedOptionsPerRequirement,
    prereqEligibleCourses: recomputed.prereqEligibleCourses,
    unassignedCompletedCourses: recomputed.unassignedCompletedCourses,
  };
}

/** Data key selecting the future term's schedule dataset for the engine. */
export function plannerTermDataKey(base: AppState, termId: string): CacheDataKey {
  return {
    termId,
    firstYear: base.firstYear,
    completedCourses: base.completedCourses,
  };
}
