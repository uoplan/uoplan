import { Button, List, Modal, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { GenerateBlocker } from "../../lib/scheduleDashboard";
import { tr } from "../../i18n";

type GenerateConfirmationModalProps = {
  opened: boolean;
  blockers: GenerateBlocker[];
  onCancel: () => void;
  onGenerateAnyway: () => void;
};

export function GenerateConfirmationModal({
  opened,
  blockers,
  onCancel,
  onGenerateAnyway,
}: GenerateConfirmationModalProps) {
  useLingui();

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={tr("schedule.generate.confirm.title")}
      centered
      radius={0}
      styles={{
        header: { backgroundColor: "#1E1E20", borderBottom: "1px solid #2C2E33" },
        body: { backgroundColor: "#1E1E20" },
        title: { color: "#F8F9FA", fontWeight: 600 },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="#ADB5BD">
          {tr("schedule.generate.confirm.body")}
        </Text>
        <List size="sm" c="#ADB5BD" spacing="sm">
          {blockers.map((blocker) => (
            <List.Item key={blocker.id}>
              <Text component="span" fw={600} c="#F8F9FA">
                {blocker.label}:{" "}
              </Text>
              {blocker.description}
              <Text size="xs" c="#A6A7AB" mt={2}>
                {blocker.consequence}
              </Text>
            </List.Item>
          ))}
        </List>
        <Text size="sm" c="#ADB5BD">
          {tr("schedule.generate.confirm.consequence")}
        </Text>
        <Stack gap="xs">
          <Button variant="filled" color="gray" radius={0} onClick={onGenerateAnyway}>
            {tr("schedule.generate.confirm.generateAnyway")}
          </Button>
          <Button variant="subtle" color="gray" radius={0} onClick={onCancel}>
            {tr("schedule.generate.confirm.cancel")}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
