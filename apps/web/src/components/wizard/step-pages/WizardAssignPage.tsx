import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { AssignStep } from "../../requirements/AssignStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardAssignPage() {
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedRequirementsList = useAppStore((s) => s.completedRequirementsList);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const unassignedCompletedCourses = useAppStore((s) => s.unassignedCompletedCourses);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const filteredPrereqEligibleCourses = useAppStore((s) => s.filteredPrereqEligibleCourses);
  const includeClosedComponents = useAppStore((s) => s.includeClosedComponents);
  const virtualSectionsOnly = useAppStore((s) => s.virtualSectionsOnly);
  const setSelectedForRequirement = useAppStore((s) => s.setSelectedForRequirement);

  return (
    <WizardShell activeStep={WizardStep.Assign}>
      <Stack gap="md">
        <AssignStep
          cache={cache}
          remainingRequirements={remainingRequirements}
          requirementTreeWithStatus={requirementTreeWithStatus}
          completedRequirementsList={completedRequirementsList}
          completedCourses={completedCourses}
          unassignedCompletedCourses={unassignedCompletedCourses}
          constrainedPerRequirement={constrainedPerRequirement}
          selectedPerRequirement={selectedPerRequirement}
          onSelect={setSelectedForRequirement}
          selectedOptionsPerRequirement={selectedOptionsPerRequirement}
          prereqEligibleCourses={filteredPrereqEligibleCourses}
          includeClosedComponents={includeClosedComponents}
          virtualSectionsOnly={virtualSectionsOnly}
        />
      </Stack>
    </WizardShell>
  );
}
