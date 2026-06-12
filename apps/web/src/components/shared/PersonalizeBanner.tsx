import { useState } from "react";
import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { Link, useLocation } from "@tanstack/react-router";
import { IconArrowRight, IconSparkles, IconX } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../store/appStore";
import { tr, useTr } from "../../i18n";
import classes from "./PersonalizeBanner.module.css";

// Routes where a not-yet-personalized user benefits from setting up their
// profile. Excludes home, trends, graph, changelog, and personalize itself.
const NUDGE_ROUTE_PREFIXES = ["/explore", "/schedule"];

/**
 * A slim, dismissible top-of-page nudge shown on the planning routes when the
 * user has not set their program or completed courses yet. Pointing them at
 * /personalize unlocks requirement-aware schedules and recommendations.
 *
 * Rendered once in the root layout (always mounted), so a dismissal sticks
 * across in-session navigation. It self-gates on route + personalization state,
 * returning null when it should not appear.
 */
export function PersonalizeBanner() {
  useTr();
  const [dismissed, setDismissed] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname });
  const { indices, program, completedCount } = useAppStore(
    useShallow((s) => ({
      indices: s.indices,
      program: s.program,
      completedCount: s.completedCourses.length,
    })),
  );

  const onNudgeRoute = NUDGE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const personalized = Boolean(program) || completedCount > 0;

  // Only render once app data is loaded, so the personalization signal is
  // reliable (program/completed courses resolve from the catalogue).
  if (!indices || dismissed || !onNudgeRoute || personalized) return null;

  return (
    <Box className={classes.wrapper}>
      <Box component="aside" role="note" className={classes.banner}>
        <Box component={Link} to="/personalize" className={classes.pill}>
          <Group wrap="nowrap" gap="sm" align="center" className={classes.row}>
            <Box
              aria-hidden
              style={{ display: "flex", color: "var(--app-warning)", flexShrink: 0 }}
            >
              <IconSparkles size={18} />
            </Box>

            <Text
              size="sm"
              c="var(--app-text)"
              className={classes.textFull}
              style={{ flex: 1, minWidth: 0 }}
            >
              {tr("personalizeBanner.message")}
            </Text>
            <Text
              size="sm"
              c="var(--app-text)"
              className={classes.textShort}
              style={{ flex: 1, minWidth: 0 }}
            >
              {tr("personalizeBanner.messageShort")}
            </Text>

            <Box aria-hidden className={classes.cta}>
              {tr("app.nav.dest.personalize.label")}
              <IconArrowRight className={classes.arrow} size={16} stroke={2} />
            </Box>
          </Group>
        </Box>

        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={tr("personalizeBanner.dismiss")}
          onClick={() => setDismissed(true)}
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
    </Box>
  );
}
