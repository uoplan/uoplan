import { Box } from "@mantine/core";
import { useCompletedCourses, useRequirementActions, useRequirementState } from "../../store/hooks";
import { OptionsStep } from "../requirements/OptionsStep";

export function OptionsPanel() {
  const { requirementTreeWithStatus, selectedOptionsPerRequirement } = useRequirementState();
  const { completedCourses } = useCompletedCourses();
  const { setSelectedOptionForRequirement, clearSelectedOptionForRequirement } =
    useRequirementActions();

  return (
    <Box p="lg">
      <OptionsStep
        requirementTreeWithStatus={requirementTreeWithStatus}
        completedCourses={completedCourses}
        selectedOptionsPerRequirement={selectedOptionsPerRequirement}
        onSelectOption={setSelectedOptionForRequirement}
        onClearOption={clearSelectedOptionForRequirement}
      />
    </Box>
  );
}
