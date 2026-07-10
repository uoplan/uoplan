import { Box } from "@mantine/core";
import {
  useCompletedCourses,
  useDataCache,
  useGenerationConstraints,
  useRequirementActions,
} from "@uoplan/store/hooks";
import { AssignStep } from "../requirements/AssignStep";
import { useRequirementAssignmentState } from "../requirements/useRequirementAssignmentState";

export function AssignPanel() {
  const cache = useDataCache();
  const { completedCourses } = useCompletedCourses();
  const requirementAssignmentState = useRequirementAssignmentState();
  const { includeClosedComponents, virtualSectionsOnly } = useGenerationConstraints();
  const { setSelectedForRequirement } = useRequirementActions();

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
