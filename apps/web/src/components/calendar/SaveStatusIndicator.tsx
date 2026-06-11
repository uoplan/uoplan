import { useEffect, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCloudCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { flushPersistedAppState } from "../../lib/persistAppState";
import { tr, useTr } from "../../i18n";
import { AnimatedIconSwap } from "../shared/AnimatedIconSwap";

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return tr("saveStatus.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return tr("saveStatus.savedMinuteAgo");
  return tr("saveStatus.savedMinutesAgo", { n: diffMin });
}

export function SaveStatusIndicator() {
  useTr();
  const hasPendingSave = useAppStore((s) => s.hasPendingSave);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!hasPendingSave && !lastSavedAt) return null;

  const tooltip = hasPendingSave
    ? lastSavedAt
      ? tr("saveStatus.unsavedSince", { time: formatRelativeTime(lastSavedAt) })
      : tr("saveStatus.unsaved")
    : tr("saveStatus.savedAt", { time: formatRelativeTime(lastSavedAt as number) });

  return (
    <Tooltip label={tooltip} withArrow position="right">
      <ActionIcon
        variant="subtle"
        color={hasPendingSave ? "orange" : "gray"}
        size="md"
        radius="md"
        onClick={flushPersistedAppState}
        aria-label={hasPendingSave ? tr("saveStatus.saveNow") : tr("saveStatus.saved")}
        style={{
          opacity: hasPendingSave ? 1 : 0.4,
          transition: "opacity 0.2s ease, color 0.2s ease",
        }}
      >
        <AnimatedIconSwap statusKey={hasPendingSave ? "pending" : "saved"}>
          {hasPendingSave ? <IconDeviceFloppy size={16} /> : <IconCloudCheck size={16} />}
        </AnimatedIconSwap>
      </ActionIcon>
    </Tooltip>
  );
}
