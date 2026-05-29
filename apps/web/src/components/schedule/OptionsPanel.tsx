import { Box } from "@mantine/core";
import { useAppStore } from "../../store/appStore";
import { OptionsStep } from "../requirements/OptionsStep";

export function OptionsPanel() {
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const setSelectedOptionForRequirement = useAppStore((s) => s.setSelectedOptionForRequirement);
  const clearSelectedOptionForRequirement = useAppStore((s) => s.clearSelectedOptionForRequirement);

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
