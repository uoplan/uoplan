import { useState } from "react";
import { Button, List, Modal, Stack, Text } from "@mantine/core";
import { useAppStore } from "../../../store/appStore";
import { ProgramStep } from "../../steps/ProgramStep";
import { WizardStep } from "../../../lib/wizardSteps";
import { WizardShell } from "../WizardShell";
import { navigateToCalendar } from "../../../lib/appNavigation";
import { tr } from "../../../i18n";
import { useLingui } from "@lingui/react";

export function WizardProgramPage() {
  useLingui();
  const catalogue = useAppStore((s) => s.catalogue);
  const program = useAppStore((s) => s.program);
  const setProgram = useAppStore((s) => s.setProgram);
  const [skipModalOpen, setSkipModalOpen] = useState(false);

  const programs = catalogue?.programs ?? [];

  const handleSkipConfirm = () => {
    setSkipModalOpen(false);
    navigateToCalendar();
  };

  return (
    <WizardShell activeStep={WizardStep.Program}>
      <Stack gap="md">
        <Button variant="default" size="sm" radius={0} onClick={() => setSkipModalOpen(true)}>
          {tr("programStep.skip.button")}
        </Button>
        <ProgramStep programs={programs} value={program?.url ?? null} onChange={setProgram} />
      </Stack>

      <Modal
        opened={skipModalOpen}
        onClose={() => setSkipModalOpen(false)}
        title={tr("programStep.skip.title")}
        centered
        radius={0}
        styles={{
          header: { backgroundColor: "#1E1E20", borderBottom: "1px solid #2C2E33" },
          body: { backgroundColor: "#1E1E20" },
          title: { color: "#F8F9FA", fontWeight: 600 },
        }}
      >
        <Stack gap="md">
          <Text size="sm" style={{ color: "#ADB5BD" }}>
            {tr("programStep.skip.body")}
          </Text>
          <List size="sm" style={{ color: "#ADB5BD" }}>
            <List.Item>{tr("programStep.skip.missing.requirements")}</List.Item>
            <List.Item>{tr("programStep.skip.missing.completedCourses")}</List.Item>
            <List.Item>{tr("programStep.skip.missing.programMatching")}</List.Item>
          </List>
          <Text size="sm" style={{ color: "#ADB5BD" }}>
            {tr("programStep.skip.basicModeNote")}
          </Text>
          <Stack gap="xs">
            <Button variant="filled" color="gray" radius={0} onClick={handleSkipConfirm}>
              {tr("programStep.skip.confirm")}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              radius={0}
              onClick={() => setSkipModalOpen(false)}
            >
              {tr("programStep.skip.cancel")}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </WizardShell>
  );
}
