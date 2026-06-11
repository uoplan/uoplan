import { useAppStore } from "../../store/appStore";

export function useRequirementAssignmentState() {
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedRequirementsList = useAppStore((s) => s.completedRequirementsList);
  const unassignedCompletedCourses = useAppStore((s) => s.unassignedCompletedCourses);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const filteredPrereqEligibleCourses = useAppStore((s) => s.filteredPrereqEligibleCourses);

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
