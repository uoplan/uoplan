import { Button, Group, Modal, Stack, Text, rem } from "@mantine/core";

const MODAL_PAD = rem(24);

interface ResetModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetModal({ opened, onClose, onConfirm }: ResetModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Reset planner?"
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
          paddingTop: 0,
        },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          This will clear your program, completed courses, requirement selections, and generated
          schedules. You cannot undo this.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" variant="filled" onClick={onConfirm}>
            Reset
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
