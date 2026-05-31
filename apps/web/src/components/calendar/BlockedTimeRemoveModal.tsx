import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { BlockedTime } from "../../store/types";
import { tr } from "../../i18n";
import { DAY_LABELS } from "@uoplan/calendar";
import { formatTimeRange } from "./calendarEventDisplayUtils";

interface BlockedTimeRemoveModalProps {
  block: BlockedTime | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function BlockedTimeRemoveModal({ block, onClose, onConfirm }: BlockedTimeRemoveModalProps) {
  useLingui();
  const range = block
    ? `${DAY_LABELS[block.day]} · ${formatTimeRange(block.startMinutes, block.endMinutes)}`
    : "";

  return (
    <Modal
      opened={block !== null}
      onClose={onClose}
      title={tr("calendar.blockedTime.removeTitle")}
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm">{tr("calendar.blockedTime.removeBody", { range })}</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {tr("calendar.blockedTime.removeCancel")}
          </Button>
          <Button
            color="red"
            onClick={() => {
              if (block) onConfirm(block.id);
            }}
          >
            {tr("calendar.blockedTime.removeConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
