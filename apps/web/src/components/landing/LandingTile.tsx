import { Link } from "@tanstack/react-router";
import { Badge, Box, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { AppCard } from "../shared/AppCard";

export type LandingTileProps = {
  to: string;
  title: string;
  description: string;
  badgeLabel?: string;
  badgeColor?: "blue" | "orange";
  icon: ReactNode;
  /** CSS colour for the icon; falls back to the theme accent when omitted. */
  iconColor?: string;
  ariaLabel: string;
};

export function LandingTile({
  to,
  title,
  description,
  badgeLabel,
  badgeColor = "blue",
  icon,
  iconColor,
  ariaLabel,
}: LandingTileProps) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      style={{
        display: "block",
        height: "100%",
        textDecoration: "none",
      }}
    >
      <AppCard
        interactive
        radius={40}
        style={{
          position: "relative",
          height: "100%",
          minHeight: 200,
          overflow: "hidden",
          borderColor: "var(--app-border-strong)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "var(--mantine-spacing-xl)",
          paddingBottom: badgeLabel
            ? "calc(var(--mantine-spacing-xl) + 28px)"
            : "var(--mantine-spacing-xl)",
        }}
      >
        <Stack gap="sm" align="center" ta="center">
          <Box
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: "var(--app-radius-lg)",
              background: iconColor
                ? `color-mix(in oklab, ${iconColor} 16%, transparent)`
                : "var(--app-accent-soft)",
              color: iconColor ?? "var(--app-accent)",
              marginBottom: 4,
            }}
          >
            {icon}
          </Box>
          <Text fw={600} size="lg" c="var(--app-text)">
            {title}
          </Text>
          <Text size="sm" c="var(--app-text-muted)" lh={1.55}>
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
              letterSpacing: "0.03em",
              background:
                badgeColor === "blue" ? "var(--app-info-soft)" : "var(--app-warning-soft)",
              color: badgeColor === "blue" ? "var(--app-info)" : "var(--app-warning)",
              border: "none",
              whiteSpace: "nowrap",
            }}
          >
            {badgeLabel}
          </Badge>
        ) : null}
      </AppCard>
    </Link>
  );
}
