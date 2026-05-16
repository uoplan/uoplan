import { useState } from "react";
import { Stack } from "@mantine/core";
import { ModeStep } from "../../steps/ModeStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardModePage() {
  const [selectedMode, setSelectedMode] = useState<"basic" | "advanced" | null>(null);

  return (
    <WizardShell activeStep={WizardStep.Mode} modeSelection={selectedMode}>
      <Stack gap="md">
        <ModeStep value={selectedMode} onChange={setSelectedMode} />
      </Stack>
    </WizardShell>
  );
}
