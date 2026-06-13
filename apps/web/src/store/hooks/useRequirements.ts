import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Computed requirement state: the remaining-requirements list, the status tree, the
 * completed-requirements list, and the per-requirement selection/constraint/option/
 * priority maps. Read-only projection; pair with {@link useRequirementActions} for
 * mutators. Grouped behind {@link useShallow}.
 */
export function useRequirementState() {
  return useAppStore(
    useShallow((s) => ({
      remainingRequirements: s.remainingRequirements,
      requirementTreeWithStatus: s.requirementTreeWithStatus,
      completedRequirementsList: s.completedRequirementsList,
      selectedPerRequirement: s.selectedPerRequirement,
      selectedOptionsPerRequirement: s.selectedOptionsPerRequirement,
      constrainedPerRequirement: s.constrainedPerRequirement,
      autoConstrainedPerRequirement: s.autoConstrainedPerRequirement,
      requirementPriorities: s.requirementPriorities,
      requirementSlotsUserTouched: s.requirementSlotsUserTouched,
      prereqEligibleCourses: s.prereqEligibleCourses,
      filteredPrereqEligibleCourses: s.filteredPrereqEligibleCourses,
    })),
  );
}

/** Mutators for requirement assignments, options, constraints and priorities. */
export function useRequirementActions() {
  const setSelectedForRequirement = useAppStore((s) => s.setSelectedForRequirement);
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);
  const setSelectedOptionForRequirement = useAppStore((s) => s.setSelectedOptionForRequirement);
  const clearSelectedOptionForRequirement = useAppStore((s) => s.clearSelectedOptionForRequirement);
  const setRequirementPriorities = useAppStore((s) => s.setRequirementPriorities);
  const applyDesiredAutoAssignments = useAppStore((s) => s.applyDesiredAutoAssignments);

  return {
    setSelectedForRequirement,
    setConstrainedForRequirement,
    setSelectedOptionForRequirement,
    clearSelectedOptionForRequirement,
    setRequirementPriorities,
    applyDesiredAutoAssignments,
  };
}
