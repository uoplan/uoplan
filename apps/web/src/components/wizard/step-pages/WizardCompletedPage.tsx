import { Stack } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { CompletedCoursesStep } from "../../steps/CompletedCoursesStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";

export function WizardCompletedPage() {
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const program = useAppStore((s) => s.program);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);

  return (
    <WizardShell activeStep={WizardStep.Completed}>
      <Stack gap="md">
        <CompletedCoursesStep
          cache={cache}
          remainingRequirements={remainingRequirements}
          completedCourses={completedCourses}
          onChange={setCompletedCourses}
          hasProgram={!!program}
        />
      </Stack>
    </WizardShell>
  );
}
