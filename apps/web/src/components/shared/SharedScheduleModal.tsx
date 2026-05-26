import { Button, Group, Modal, Stack, Text, rem } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";

const MODAL_PAD = rem(24);

export function SharedScheduleModal() {
  useLingui();
  const pendingSharedState = useAppStore((s) => s.pendingSharedState);
  const acceptSharedState = useAppStore((s) => s.acceptSharedState);
  const dismissSharedState = useAppStore((s) => s.dismissSharedState);

  return (
    <Modal
      opened={pendingSharedState !== null}
      onClose={dismissSharedState}
      title={tr("sharedSchedule.title")}
      size="sm"
      centered
      radius={0}
      styles={{
        header: {
          padding: MODAL_PAD,
          paddingInlineEnd: `calc(${MODAL_PAD} - calc(0.3125rem * var(--mantine-scale)))`,
        },
        body: {
          padding: MODAL_PAD,
        },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {tr("sharedSchedule.body")}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={dismissSharedState}>
            {tr("sharedSchedule.keepMine")}
          </Button>
          <Button variant="filled" onClick={acceptSharedState}>
            {tr("sharedSchedule.load")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
