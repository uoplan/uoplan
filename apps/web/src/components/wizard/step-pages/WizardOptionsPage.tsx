import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { OptionsStep } from "../../requirements/OptionsStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardOptionsPage() {
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const setSelectedOptionForRequirement = useAppStore((s) => s.setSelectedOptionForRequirement);
  const clearSelectedOptionForRequirement = useAppStore((s) => s.clearSelectedOptionForRequirement);

  return (
    <WizardShell activeStep={WizardStep.Options}>
      <Stack gap="md">
        <OptionsStep
          requirementTreeWithStatus={requirementTreeWithStatus}
          completedCourses={completedCourses}
          selectedOptionsPerRequirement={selectedOptionsPerRequirement}
          onSelectOption={setSelectedOptionForRequirement}
          onClearOption={clearSelectedOptionForRequirement}
        />
      </Stack>
    </WizardShell>
  );
}
