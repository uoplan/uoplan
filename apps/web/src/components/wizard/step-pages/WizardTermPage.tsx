import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { TermStep } from "../../steps/TermStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardTermPage() {
  const terms = useAppStore((s) => s.terms);
  const selectedTermId = useAppStore((s) => s.selectedTermId);
  const setSelectedTermId = useAppStore((s) => s.setSelectedTermId);

  return (
    <WizardShell activeStep={WizardStep.Term}>
      {terms && (
        <Stack gap="md">
          <TermStep
            terms={terms}
            value={selectedTermId}
            onChange={(termId) => {
              void setSelectedTermId(termId);
            }}
          />
        </Stack>
      )}
    </WizardShell>
  );
}
