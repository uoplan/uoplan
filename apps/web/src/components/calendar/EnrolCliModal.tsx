import { ActionIcon, Code, CopyButton, Group, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";

interface EnrolCliModalProps {
  opened: boolean;
  onClose: () => void;
  command: string;
}

export function EnrolCliModal({ opened, onClose, command }: EnrolCliModalProps) {
  useLingui();
  return (
    <Modal opened={opened} onClose={onClose} title={tr("enrolCli.modal.title")} size="md" centered>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {tr("enrolCli.modal.description")}
        </Text>
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Code block style={{ flex: 1, wordBreak: "break-all" }}>
            {command}
          </Code>
          <CopyButton value={command} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? tr("enrolCli.modal.copied") : tr("enrolCli.modal.copy")}
                withArrow
              >
                <ActionIcon variant="light" color={copied ? "teal" : "gray"} onClick={copy}>
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      </Stack>
    </Modal>
  );
}
