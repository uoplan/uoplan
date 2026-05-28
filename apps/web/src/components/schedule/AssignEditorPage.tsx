import { Stack } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { AssignStep } from "../requirements/AssignStep";
import { ScheduleEditorShell } from "./ScheduleEditorShell";

export function AssignEditorPage() {
  useLingui();
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
    <ScheduleEditorShell
      step="assign"
      title={tr("schedule.editor.assign.title")}
      subtitle={tr("schedule.editor.assign.subtitle")}
    >
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
    </ScheduleEditorShell>
  );
}
