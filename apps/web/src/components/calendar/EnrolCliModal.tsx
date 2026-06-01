import {
  ActionIcon,
  Alert,
  Code,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy, IconDeviceMobileOff } from "@tabler/icons-react";
import { useTr } from "../../i18n";

const COPY_CODE_LABEL_ID = "enrolCli.modal.copyCode";

interface EnrolCliModalProps {
  opened: boolean;
  onClose: () => void;
  command: string;
}

function getInstallCommand(): string | null {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Win/i.test(ua)) return "irm https://uoplan.party/install.ps1 | iex";
  return "curl -fsSL https://uoplan.party/install.sh | sh";
}

function CopyRow({ value }: { value: string }) {
  const tr = useTr();
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Code block style={{ flex: 1, wordBreak: "break-all" }}>
        {value}
      </Code>
      <CopyButton value={value} timeout={2000}>
        {({ copied, copy }) => (
          <Tooltip
            label={copied ? tr("enrolCli.modal.copied") : tr("enrolCli.modal.copy")}
            withArrow
          >
            <ActionIcon
              variant="light"
              color={copied ? "teal" : "gray"}
              onClick={copy}
              aria-label={tr(COPY_CODE_LABEL_ID)}
              title={tr(COPY_CODE_LABEL_ID)}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

export function EnrolCliModal({ opened, onClose, command }: EnrolCliModalProps) {
  const tr = useTr();
  const installCommand = getInstallCommand();

  return (
    <Modal opened={opened} onClose={onClose} title={tr("enrolCli.modal.title")} size="md" centered>
      <Stack gap="md">
        {installCommand === null ? (
          <Alert icon={<IconDeviceMobileOff size={16} />} color="gray">
            {tr("enrolCli.modal.mobileUnavailable")}
          </Alert>
        ) : (
          <>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {tr("enrolCli.modal.stepInstall")}
              </Text>
              <CopyRow value={installCommand} />
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                {tr("enrolCli.modal.stepRun")}
              </Text>
              <Text size="sm" c="dimmed">
                {tr("enrolCli.modal.description")}
              </Text>
              <CopyRow value={command} />
            </Stack>
          </>
        )}
      </Stack>
    </Modal>
  );
}
