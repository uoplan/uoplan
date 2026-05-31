import { Link } from "@tanstack/react-router";
import { Badge, Box, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { tr } from "../../i18n";

export type LandingTileProps = {
  to: string;
  title: string;
  description: string;
  badgeLabel?: string;
  badgeColor?: "blue" | "orange";
  icon: ReactNode;
  ariaLabel: string;
};

export function LandingTile({
  to,
  title,
  description,
  badgeLabel,
  badgeColor = "blue",
  icon,
  ariaLabel,
}: LandingTileProps) {
  return (
    <Link
      to={to}
      state={{ back: { to: "/", label: tr("app.nav.backHome") } } as never}
      aria-label={ariaLabel}
      style={{
        display: "block",
        height: "100%",
        textDecoration: "none",
      }}
    >
      <Paper
        withBorder
        radius={0}
        className="stamp-hover"
        style={{
          position: "relative",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "var(--app-surface)",
          border: "2px solid var(--app-border)",
          padding: "var(--mantine-spacing-lg)",
          paddingBottom: badgeLabel
            ? "calc(var(--mantine-spacing-lg) + 28px)"
            : "var(--mantine-spacing-lg)",
        }}
      >
        <Stack gap="md" align="center" ta="center">
          <Box c="violet.4" style={{ lineHeight: 0 }}>
            {icon}
          </Box>
          <Text fw={600} size="md" c="var(--app-text)">
            {title}
          </Text>
          <Text size="sm" c="dimmed" lh={1.5}>
            {description}
          </Text>
        </Stack>
        {badgeLabel ? (
          <Badge
            color={badgeColor}
            variant="light"
            size="sm"
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              background:
                badgeColor === "blue" ? "rgba(51, 154, 240, 0.12)" : "rgba(255, 146, 43, 0.12)",
              color: badgeColor === "blue" ? "#74C0FC" : "#FFA94D",
              border: "none",
              whiteSpace: "nowrap",
            }}
          >
            {badgeLabel}
          </Badge>
        ) : null}
      </Paper>
    </Link>
  );
}
