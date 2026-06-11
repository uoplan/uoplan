import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCheck, IconShare } from "@tabler/icons-react";
import { tr } from "../../i18n";
import { AnimatedIconSwap } from "../shared/AnimatedIconSwap";

interface CalendarShareActionProps {
  show: boolean;
  copied: boolean;
  onCopy: () => void;
}

export function CalendarShareAction({ show, copied, onCopy }: CalendarShareActionProps) {
  if (!show) return null;

  return (
    <Tooltip
      label={copied ? tr("app.share.copied") : tr("calendarPage.share")}
      withArrow
      position="right"
      opened={copied || undefined}
    >
      <ActionIcon
        variant="subtle"
        color={copied ? "teal" : "gray"}
        size="md"
        radius="md"
        onClick={onCopy}
        aria-label={tr("calendarPage.share")}
        style={{ transition: "color 0.2s ease" }}
      >
        <AnimatedIconSwap statusKey={copied ? "copied" : "share"}>
          {copied ? <IconCheck size={16} /> : <IconShare size={16} />}
        </AnimatedIconSwap>
      </ActionIcon>
    </Tooltip>
  );
}
