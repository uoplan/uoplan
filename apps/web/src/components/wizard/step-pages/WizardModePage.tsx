import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { ModeStep } from "../../steps/ModeStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardModePage() {
  const wizardMode = useAppStore((s) => s.wizardMode);
  const setWizardMode = useAppStore((s) => s.setWizardMode);

  return (
    <WizardShell activeStep={WizardStep.Mode}>
      <Stack gap="md">
        <ModeStep
          value={wizardMode}
          onChange={(mode) => {
            setWizardMode(mode);
          }}
        />
      </Stack>
    </WizardShell>
  );
}
