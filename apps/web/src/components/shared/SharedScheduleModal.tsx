import { Button, Group, Modal, rem, Stack, Text } from "@mantine/core";
import { useShareState } from "../../store/hooks";
import { tr, useTr } from "../../i18n";

const MODAL_PAD = rem(24);

export function SharedScheduleModal() {
  useTr();
  const { pendingSharedState, acceptSharedState, dismissSharedState } = useShareState();

  return (
    <Modal
      opened={pendingSharedState !== null}
      onClose={dismissSharedState}
      title={tr("sharedSchedule.title")}
      size="sm"
      centered
      radius="lg"
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
        <Group justify="flex-end" gap="xs" wrap="nowrap">
          <Button variant="default" onClick={dismissSharedState}>
            {tr("sharedSchedule.keepMine")}
          </Button>
          <Button variant="filled" color="red" onClick={acceptSharedState}>
            {tr("sharedSchedule.load")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
