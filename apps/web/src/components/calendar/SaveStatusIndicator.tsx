import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconDeviceFloppy, IconCloudCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { flushPersistedAppState } from "../../lib/persistAppState";
import { tr } from "../../i18n";

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return tr("saveStatus.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return tr("saveStatus.savedMinuteAgo");
  return tr("saveStatus.savedMinutesAgo", { n: diffMin });
}

export function SaveStatusIndicator() {
  useLingui();
  const hasPendingSave = useAppStore((s) => s.hasPendingSave);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (hasPendingSave) {
    const sinceLabel = lastSavedAt ? formatRelativeTime(lastSavedAt) : null;
    const tooltip = sinceLabel
      ? tr("saveStatus.unsavedSince", { time: sinceLabel })
      : tr("saveStatus.unsaved");

    return (
      <Tooltip label={tooltip} withArrow position="right" color="dark">
        <ActionIcon
          variant="subtle"
          color="orange"
          size="md"
          radius={0}
          onClick={flushPersistedAppState}
          aria-label={tr("saveStatus.saveNow")}
        >
          <IconDeviceFloppy size={16} />
        </ActionIcon>
      </Tooltip>
    );
  }

  if (!lastSavedAt) return null;

  return (
    <Tooltip
      label={tr("saveStatus.savedAt", { time: formatRelativeTime(lastSavedAt) })}
      withArrow
      position="right"
      color="dark"
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        radius={0}
        onClick={flushPersistedAppState}
        aria-label={tr("saveStatus.saved")}
        style={{ opacity: 0.4 }}
      >
        <IconCloudCheck size={16} />
      </ActionIcon>
    </Tooltip>
  );
}
