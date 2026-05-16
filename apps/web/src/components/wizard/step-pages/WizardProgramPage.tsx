import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { ProgramStep } from "../../steps/ProgramStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardProgramPage() {
  const catalogue = useAppStore((s) => s.catalogue);
  const program = useAppStore((s) => s.program);
  const setProgram = useAppStore((s) => s.setProgram);

  const programs = catalogue?.programs ?? [];

  return (
    <WizardShell activeStep={WizardStep.Program}>
      <Stack gap="md">
        <ProgramStep programs={programs} value={program?.url ?? null} onChange={setProgram} />
      </Stack>
    </WizardShell>
  );
}
