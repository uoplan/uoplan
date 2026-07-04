import { Box, Text, Tooltip, VisuallyHidden } from "@mantine/core";
import { IconCheck, IconMinus, IconX } from "@tabler/icons-react";
import { tr } from "../../i18n";
import type { FeatureSupport, SupportLevel } from "../../lib/comparison";

const LEVEL_META: Record<
  SupportLevel,
  { color: string; bg: string; Icon: typeof IconCheck; labelId: string }
> = {
  yes: {
    color: "var(--app-success)",
    bg: "var(--app-success-soft)",
    Icon: IconCheck,
    labelId: "compare.support.yes",
  },
  partial: {
    color: "var(--app-warning)",
    bg: "var(--app-warning-soft)",
    Icon: IconMinus,
    labelId: "compare.support.partial",
  },
  no: {
    color: "var(--app-text-dim)",
    bg: "var(--app-translucent)",
    Icon: IconX,
    labelId: "compare.support.no",
  },
};

/**
 * A single support marker (check / partial / cross) with an accessible label
 * and an optional clarifying-note tooltip. Shared by the master matrix and the
 * `/vs` tables so every cell reads identically.
 */
export function SupportCell({ support }: { support: FeatureSupport }) {
  const meta = LEVEL_META[support.level];
  const { Icon } = meta;
  const label = tr(meta.labelId);
  const note = support.noteId ? tr(support.noteId) : null;

  const marker = (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "var(--app-radius-pill)",
        background: meta.bg,
        color: meta.color,
      }}
    >
      <Icon size={16} stroke={2.4} aria-hidden />
      <VisuallyHidden>{note ? `${label}. ${note}` : label}</VisuallyHidden>
    </Box>
  );

  if (!note) return marker;

  return (
    <Tooltip
      label={note}
      withArrow
      multiline
      w={220}
      events={{ hover: true, focus: true, touch: true }}
    >
      <Box style={{ display: "inline-flex", position: "relative" }}>
        {marker}
        <Box
          aria-hidden
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meta.color,
          }}
        />
      </Box>
    </Tooltip>
  );
}

/** Compact inline legend explaining the three support markers. */
export function SupportLegend() {
  return (
    <Box style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {(["yes", "partial", "no"] as const).map((level) => {
        const meta = LEVEL_META[level];
        const { Icon } = meta;
        return (
          <Box key={level} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Box
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "var(--app-radius-pill)",
                background: meta.bg,
                color: meta.color,
              }}
            >
              <Icon size={13} stroke={2.4} />
            </Box>
            <Text span size="xs" c="var(--app-text-muted)">
              {tr(meta.labelId)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
