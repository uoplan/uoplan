import type { CourseLanguageBucket, CourseLevelBucket, DataCache, Program } from "@uoplan/core";
import {
  buildPrereqContext,
  canTakeCourse,
  computeRequirementAutoAssignment,
  computeRequirementsState,
  courseMatchesFilters,
} from "@uoplan/core";
import { mergeProgramWithMinor } from "./minorMerge";
import type { RecomputedState } from "./types";

export * from "./types";
export * from "./utils";
export * from "./minorMerge";

export function recomputeStateForProgram(
  program: Program | null,
  minorProgram: Program | null,
  completedCourses: string[],
  cache: DataCache | null,
  existingSelectedPerRequirement: Record<string, string[]>,
  existingSelectedOptionsPerRequirement: Record<string, number>,
  levelBuckets: CourseLevelBucket[],
  languageBuckets: CourseLanguageBucket[],
  _includeClosedComponents: boolean,
  studentPrograms: string[] = [],
  requirementSlotsUserTouched: Record<string, true> = {},
): RecomputedState {
  if (!program || !cache) {
    return {
      remainingRequirements: [],
      requirementTreeWithStatus: [],
      completedRequirementsList: [],
      selectedPerRequirement: {},
      selectedOptionsPerRequirement: {},
      prereqEligibleCourses: [],
      filteredPrereqEligibleCourses: [],
      unassignedCompletedCourses: [],
    };
  }

  const effectiveProgram = minorProgram
    ? mergeProgramWithMinor(program, minorProgram, cache)
    : program;

  const { remaining, tree, completedList } = computeRequirementsState(
    effectiveProgram,
    completedCourses,
    cache,
    existingSelectedOptionsPerRequirement,
  );

  const autoAssignment = computeRequirementAutoAssignment({
    remaining,
    tree,
    completedCourses,
    cache,
    selectedPerRequirement: existingSelectedPerRequirement,
    requirementSlotsUserTouched,
  });
  const augmentedRemaining = autoAssignment.augmentedRemaining;

  const ctx = buildPrereqContext(completedCourses, cache, studentPrograms);
  const candidateSet = new Set<string>();
  for (const req of augmentedRemaining) {
    for (const code of req.candidateCourses) {
      candidateSet.add(code);
    }
  }
  for (const course of cache.getAllCourses()) {
    candidateSet.add(course.code);
  }
  const prereqEligibleCourses: string[] = [];
  for (const code of candidateSet) {
    if (canTakeCourse(code, cache, ctx)) {
      prereqEligibleCourses.push(code);
    }
  }

  const filters = { levels: levelBuckets, languageBuckets };
  const filteredPrereqEligibleCourses = prereqEligibleCourses.filter((code) =>
    courseMatchesFilters(code, filters),
  );

  return {
    remainingRequirements: augmentedRemaining,
    requirementTreeWithStatus: tree,
    completedRequirementsList: completedList,
    selectedPerRequirement: autoAssignment.selectedPerRequirement,
    selectedOptionsPerRequirement: existingSelectedOptionsPerRequirement,
    prereqEligibleCourses,
    filteredPrereqEligibleCourses,
    unassignedCompletedCourses: autoAssignment.unassignedCompletedCourses,
  };
}
