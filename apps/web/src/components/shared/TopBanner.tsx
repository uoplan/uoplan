import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import { PageContainer } from "./PageContainer";
import classes from "./TopBanner.module.css";

/**
 * The shared top-of-page slot every banner renders into. It owns the width
 * (via {@link PageContainer}) and the top offset, so the donation and
 * personalize banners always line up at the exact same height regardless of
 * which page they appear on.
 */
export function TopBannerSlot({ children }: { children: ReactNode }) {
  return (
    <Box style={{ width: "100%", paddingTop: 24 }}>
      <PageContainer>{children}</PageContainer>
    </Box>
  );
}

type TopBannerProps = {
  /** Destination the whole pill links to. */
  to: "/donate" | "/personalize";
  /** Colour scheme: "accent" (donation) or "warning" (personalize). */
  variant: "accent" | "warning";
  /** Leading icon, coloured to the variant's strong tone. */
  icon: ReactNode;
  /** Full message shown on wider viewports. */
  text: string;
  /** Condensed message shown on narrow viewports. */
  textShort: string;
  /** Call-to-action pill label. */
  ctaLabel: string;
  onDismiss: () => void;
  dismissLabel: string;
};

/**
 * The shared top-of-page banner pill used by both the donation and personalize
 * nudges. Layout, sizing, hover/press motion, responsive text and the dismiss
 * affordance are identical across both; only the colour scheme differs, driven
 * by the `data-variant` attribute (see TopBanner.module.css). Width and vertical
 * placement are owned by the host slot so every banner lines up at the same
 * height.
 */
export function TopBanner({
  to,
  variant,
  icon,
  text,
  textShort,
  ctaLabel,
  onDismiss,
  dismissLabel,
}: TopBannerProps) {
  return (
    <Box component="aside" role="note" className={classes.banner} data-variant={variant}>
      <Box component={Link} to={to} className={classes.pill}>
        <Group wrap="nowrap" gap="sm" align="center" className={classes.row}>
          <Box aria-hidden className={classes.icon}>
            {icon}
          </Box>

          <Text
            size="sm"
            c="var(--app-text)"
            className={classes.textFull}
            style={{ flex: 1, minWidth: 0 }}
          >
            {text}
          </Text>
          <Text
            size="sm"
            c="var(--app-text)"
            className={classes.textShort}
            style={{ flex: 1, minWidth: 0 }}
          >
            {textShort}
          </Text>

          <Box aria-hidden className={classes.cta}>
            {ctaLabel}
            <IconArrowRight className={classes.arrow} size={16} stroke={2} />
          </Box>
        </Group>
      </Box>

      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={dismissLabel}
        onClick={onDismiss}
        style={{
          position: "absolute",
          top: "50%",
          right: 12,
          transform: "translateY(-50%)",
          color: "var(--app-text-muted)",
        }}
      >
        <IconX size={16} />
      </ActionIcon>
    </Box>
  );
}
