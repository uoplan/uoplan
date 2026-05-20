import { useState } from "react";
import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import { IconRefresh, IconShare, IconTerminal } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useShareUrl } from "../../hooks/useShareUrl";
import { tr } from "../../i18n";
import { ResetModal } from "../shared/ResetModal";

interface BasicCalendarHeaderActionsProps {
  onBack: () => void;
  cliCommand?: string | null;
  onEnrolCli?: () => void;
}

export function BasicCalendarHeaderActions({
  onBack,
  cliCommand,
  onEnrolCli,
}: BasicCalendarHeaderActionsProps) {
  const indices = useAppStore((s) => s.indices);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const resetToDefault = useAppStore((s) => s.resetToDefault);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  return (
    <>
      <Group gap={4} wrap="nowrap">
        {indices && (
          <Tooltip
            label={shareCopied ? tr("app.share.copied") : tr("calendarPage.share")}
            opened={shareCopied || undefined}
            position="right"
            withArrow
            color="dark"
          >
            <ActionIcon
              variant="subtle"
              color={shareCopied ? "teal" : "gray"}
              size="md"
              radius={0}
              onClick={handleCopyShare}
              aria-label={tr("calendarPage.share")}
            >
              <IconShare size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={tr("calendarPage.reset")} position="right" withArrow color="dark">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            radius={0}
            onClick={() => setResetModalOpen(true)}
            aria-label={tr("calendarPage.reset")}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
        {onEnrolCli && (
          <Button
            variant="light"
            color="green"
            size="xs"
            radius={0}
            leftSection={<IconTerminal size={12} />}
            disabled={!cliCommand}
            onClick={onEnrolCli}
            style={{ marginLeft: 4 }}
          >
            {tr("enrolCli.button")}
          </Button>
        )}
      </Group>

      <ResetModal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={() => {
          resetToDefault();
          setResetModalOpen(false);
          onBack();
        }}
      />
    </>
  );
}
