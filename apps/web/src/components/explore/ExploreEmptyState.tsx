import type { ReactNode } from "react";
import { Box, Text } from "@mantine/core";
import { IconBooksOff } from "@tabler/icons-react";

/**
 * Centered empty-state panel for explore surfaces: a token-styled icon badge, a
 * heading, and an optional description. Taller than a bare line of text so empty
 * lists read as an intentional state rather than a glitch.
 */
export function ExploreEmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "var(--mantine-spacing-sm)",
        minHeight: 260,
        paddingBlock: "var(--mantine-spacing-xl)",
        paddingInline: "var(--mantine-spacing-md)",
      }}
    >
      <Box
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 999,
          backgroundColor: "var(--app-surface)",
          border: "var(--app-border-width) solid var(--app-border)",
          color: "var(--app-text-muted)",
        }}
      >
        {icon ?? <IconBooksOff size={26} stroke={1.6} />}
      </Box>
      <Text fw={600} fz="md" c="var(--app-text)">
        {title}
      </Text>
      {description ? (
        <Text size="sm" c="dimmed" maw={420} lh={1.5}>
          {description}
        </Text>
      ) : null}
    </Box>
  );
}
