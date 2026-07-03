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

/**
 * Colour scheme for {@link TopBanner}: "accent" (donation), "warning"
 * (personalize nudge / feedback), "neutral" (a high-contrast filled pill, e.g.
 * the post-personalization "change your personalization" banner or the GitHub
 * star nudge), "success" (green, e.g. the Android closed-test banner), or "info"
 * (blue, e.g. the iOS App Store banner).
 */
export type TopBannerVariant = "accent" | "warning" | "neutral" | "success" | "info";

type TopBannerBaseProps = {
  /** Colour scheme; see {@link TopBannerVariant}. */
  variant: TopBannerVariant;
  /** Leading icon, coloured to the variant's strong tone. */
  icon: ReactNode;
  /** Full message shown on wider viewports. */
  text: string;
  /** Condensed message shown on narrow viewports. */
  textShort: string;
  /** Call-to-action pill label. */
  ctaLabel: string;
  onClick?: () => void;
  onDismiss: () => void;
  dismissLabel: string;
};

/**
 * The destination is either an internal route (`to`, a TanStack Router link) or
 * an external/`mailto:` URL (`href`, a plain anchor). The two are mutually
 * exclusive.
 */
type TopBannerProps = TopBannerBaseProps &
  ({ to: "/donate" | "/personalize"; href?: never } | { href: string; to?: never });

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
  href,
  variant,
  icon,
  text,
  textShort,
  ctaLabel,
  onClick,
  onDismiss,
  dismissLabel,
}: TopBannerProps) {
  // mailto links never open a new tab, so target/rel are reserved for http(s).
  const isExternalHttp = href !== undefined && /^https?:/i.test(href);

  const pillContent = (
    <Group wrap="nowrap" gap="sm" align="center" className={classes.row}>
      <Box aria-hidden className={classes.icon}>
        {icon}
      </Box>

      <Text
        size="sm"
        c="var(--banner-text)"
        className={classes.textFull}
        style={{ flex: 1, minWidth: 0 }}
      >
        {text}
      </Text>
      <Text
        size="sm"
        c="var(--banner-text)"
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
  );

  return (
    <Box component="aside" role="note" className={classes.banner} data-variant={variant}>
      {href ? (
        <Box
          component="a"
          href={href}
          {...(isExternalHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={classes.pill}
          onClick={onClick}
        >
          {pillContent}
        </Box>
      ) : (
        <Box component={Link} to={to} className={classes.pill} onClick={onClick}>
          {pillContent}
        </Box>
      )}

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
          color: "var(--banner-dismiss)",
        }}
      >
        <IconX size={16} />
      </ActionIcon>
    </Box>
  );
}
