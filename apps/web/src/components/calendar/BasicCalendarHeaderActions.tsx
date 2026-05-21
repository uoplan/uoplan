import { useState } from "react";
import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import {
  IconCalendarDown,
  IconEraser,
  IconFileImport,
  IconRefresh,
  IconShare,
  IconTerminal,
} from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useShareUrl } from "../../hooks/useShareUrl";
import { tr } from "../../i18n";
import { ResetModal } from "../shared/ResetModal";
import { UEnrollImportModal } from "./UEnrollImportModal";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";

interface BasicCalendarHeaderActionsProps {
  cliCommand?: string | null;
  onEnrolCli?: () => void;
  onClearOptions: () => void;
  onDownloadIcs: () => void;
  downloadDisabled?: boolean;
}

export function BasicCalendarHeaderActions({
  cliCommand,
  onEnrolCli,
  onClearOptions,
  onDownloadIcs,
  downloadDisabled,
}: BasicCalendarHeaderActionsProps) {
  const indices = useAppStore((s) => s.indices);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const resetToDefault = useAppStore((s) => s.resetToDefault);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [uenrollImportOpen, setUenrollImportOpen] = useState(false);
  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  return (
    <>
      <Group gap={4} wrap="nowrap">
        <Tooltip label={tr("calendarPage.downloadIcs")} position="right" withArrow color="dark">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            radius={0}
            disabled={downloadDisabled}
            onClick={onDownloadIcs}
            aria-label={tr("calendarPage.downloadIcs")}
          >
            <IconCalendarDown size={16} />
          </ActionIcon>
        </Tooltip>
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
        <Tooltip label={tr("basicCalendar.clear")} position="right" withArrow color="dark">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            radius={0}
            onClick={onClearOptions}
            aria-label={tr("basicCalendar.clear")}
          >
            <IconEraser size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={tr("uenrollImport.button")} position="right" withArrow color="dark">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            radius={0}
            onClick={() => setUenrollImportOpen(true)}
            aria-label={tr("uenrollImport.button")}
          >
            <IconFileImport size={16} />
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
          navigateToWizardStep(WizardStep.Term);
        }}
      />
      <UEnrollImportModal opened={uenrollImportOpen} onClose={() => setUenrollImportOpen(false)} />
    </>
  );
}
