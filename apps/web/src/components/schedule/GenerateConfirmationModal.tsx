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
      radius="lg"
      styles={{
        header: {
          backgroundColor: "var(--app-surface)",
          borderBottom: "1px solid var(--app-border)",
        },
        body: { backgroundColor: "var(--app-surface)" },
        title: { color: "var(--app-text)", fontWeight: 600 },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="var(--app-text-muted)">
          {tr("schedule.generate.confirm.body")}
        </Text>
        <List size="sm" c="var(--app-text-muted)" spacing="sm">
          {blockers.map((blocker) => (
            <List.Item key={blocker.id}>
              <Text component="span" fw={600} c="var(--app-text)">
                {blocker.label}:{" "}
              </Text>
              {blocker.description}
              <Text size="xs" c="var(--app-text-dim)" mt={2}>
                {blocker.consequence}
              </Text>
            </List.Item>
          ))}
        </List>
        <Text size="sm" c="var(--app-text-muted)">
          {tr("schedule.generate.confirm.consequence")}
        </Text>
        <Stack gap="xs">
          <Button variant="filled" color="gray" radius="md" onClick={onGenerateAnyway}>
            {tr("schedule.generate.confirm.generateAnyway")}
          </Button>
          <Button variant="subtle" color="gray" radius="md" onClick={onCancel}>
            {tr("schedule.generate.confirm.cancel")}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
