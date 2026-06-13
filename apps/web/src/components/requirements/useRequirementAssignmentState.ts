import { useCompletedCourses, useRequirementState } from "../../store/hooks";

export function useRequirementAssignmentState() {
  const {
    remainingRequirements,
    requirementTreeWithStatus,
    completedRequirementsList,
    constrainedPerRequirement,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    filteredPrereqEligibleCourses,
  } = useRequirementState();
  const { unassignedCompletedCourses } = useCompletedCourses();

  return {
    remainingRequirements,
    requirementTreeWithStatus,
    completedRequirementsList,
    unassignedCompletedCourses,
    constrainedPerRequirement,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    filteredPrereqEligibleCourses,
  };
}
