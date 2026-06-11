import { Box } from "@mantine/core";
import { useAppStore } from "../../store/appStore";
import { AssignStep } from "../requirements/AssignStep";
import { useRequirementAssignmentState } from "../requirements/useRequirementAssignmentState";

export function AssignPanel() {
  const cache = useAppStore((s) => s.cache);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const requirementAssignmentState = useRequirementAssignmentState();
  const includeClosedComponents = useAppStore((s) => s.includeClosedComponents);
  const virtualSectionsOnly = useAppStore((s) => s.virtualSectionsOnly);
  const setSelectedForRequirement = useAppStore((s) => s.setSelectedForRequirement);

  return (
    <Box p="lg">
      <AssignStep
        cache={cache}
        remainingRequirements={requirementAssignmentState.remainingRequirements}
        requirementTreeWithStatus={requirementAssignmentState.requirementTreeWithStatus}
        completedRequirementsList={requirementAssignmentState.completedRequirementsList}
        completedCourses={completedCourses}
        unassignedCompletedCourses={requirementAssignmentState.unassignedCompletedCourses}
        constrainedPerRequirement={requirementAssignmentState.constrainedPerRequirement}
        selectedPerRequirement={requirementAssignmentState.selectedPerRequirement}
        onSelect={setSelectedForRequirement}
        selectedOptionsPerRequirement={requirementAssignmentState.selectedOptionsPerRequirement}
        prereqEligibleCourses={requirementAssignmentState.filteredPrereqEligibleCourses}
        includeClosedComponents={includeClosedComponents}
        virtualSectionsOnly={virtualSectionsOnly}
      />
    </Box>
  );
}
