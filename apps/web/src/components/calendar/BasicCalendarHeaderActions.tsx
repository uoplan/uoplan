import { useState } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconCalendarDown,
  IconEraser,
  IconFileImport,
  IconShare,
  IconTerminal,
} from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useShareUrl } from "../../hooks/useShareUrl";
import { tr } from "../../i18n";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { UEnrollImportModal } from "./UEnrollImportModal";

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

  const [uenrollImportOpen, setUenrollImportOpen] = useState(false);
  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  return (
    <>
      <Group gap={4} wrap="nowrap">
        <Tooltip label={tr("calendarPage.downloadIcs")} position="right" withArrow>
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
        <SaveStatusIndicator />
        {indices && (
          <Tooltip
            label={shareCopied ? tr("app.share.copied") : tr("calendarPage.share")}
            opened={shareCopied || undefined}
            position="right"
            withArrow
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
        <Tooltip label={tr("basicCalendar.clear")} position="right" withArrow>
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
        <Tooltip label={tr("uenrollImport.button")} position="right" withArrow>
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
          <Tooltip label={tr("enrolCli.button")} position="right" withArrow>
            <ActionIcon
              variant="subtle"
              color="green"
              size="md"
              radius={0}
              disabled={!cliCommand}
              onClick={onEnrolCli}
              aria-label={tr("enrolCli.button")}
              style={{ marginLeft: 4 }}
            >
              <IconTerminal size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <UEnrollImportModal opened={uenrollImportOpen} onClose={() => setUenrollImportOpen(false)} />
    </>
  );
}
