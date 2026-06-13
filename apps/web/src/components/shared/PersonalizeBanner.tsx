import { useState } from "react";
import { Box, Text } from "@mantine/core";
import { Link, useLocation } from "@tanstack/react-router";
import { IconSparkles } from "@tabler/icons-react";
import { useActiveProgram, useCompletedCourses, useIndices } from "../../store/hooks";
import { tr, useTr } from "../../i18n";
import { TopBanner, TopBannerSlot } from "./TopBanner";
import classes from "./PersonalizeBanner.module.css";

// Routes where a not-yet-personalized user benefits from setting up their
// profile via the floating top banner. The schedule generator surfaces the same
// nudge inside its sidebar instead (variant="sidebar"), so it is excluded here.
const NUDGE_ROUTE_PREFIXES = ["/explore"];

type PersonalizeBannerProps = {
  /**
   * "floating" (default) renders the slim, dismissible top-of-page pill,
   * self-gated to the nudge routes. "sidebar" renders a compact stacked card
   * for embedding in a controls column (e.g. the schedule generator), skipping
   * the route gate so the host decides placement.
   */
  variant?: "floating" | "sidebar";
};

/**
 * A dismissible nudge shown to users who have not set their program or completed
 * courses yet. Pointing them at /personalize unlocks requirement-aware schedules
 * and recommendations. Gates on app data being loaded and the user not being
 * personalized, returning null when it should not appear.
 *
 * The floating variant is rendered once in the root layout (always mounted, so a
 * dismissal sticks across navigation) and self-gates on route; the sidebar
 * variant is placed explicitly by its host.
 */
export function PersonalizeBanner({ variant = "floating" }: PersonalizeBannerProps) {
  useTr();
  const [dismissed, setDismissed] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname });
  const indices = useIndices();
  const program = useActiveProgram();
  const { completedCourses } = useCompletedCourses();
  const completedCount = completedCourses.length;

  const onNudgeRoute =
    variant === "sidebar" || NUDGE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const personalized = Boolean(program) || completedCount > 0;

  // Only render once app data is loaded, so the personalization signal is
  // reliable (program/completed courses resolve from the catalogue).
  if (!indices || dismissed || !onNudgeRoute || personalized) return null;

  if (variant === "sidebar") {
    return (
      <Box
        component={Link}
        to="/personalize"
        role="note"
        className={classes.sidebarPill}
        data-testid="personalize-sidebar-nudge"
      >
        <Box aria-hidden style={{ display: "flex", color: "var(--app-warning)", flexShrink: 0 }}>
          <IconSparkles size={18} />
        </Box>
        <Text size="sm" c="var(--app-text)" className={classes.sidebarText}>
          {tr("personalizeBanner.messageShort")}
        </Text>
      </Box>
    );
  }

  return (
    <TopBannerSlot>
      <TopBanner
        to="/personalize"
        variant="warning"
        icon={<IconSparkles size={18} />}
        text={tr("personalizeBanner.message")}
        textShort={tr("personalizeBanner.messageShort")}
        ctaLabel={tr("app.nav.dest.personalize.label")}
        onDismiss={() => setDismissed(true)}
        dismissLabel={tr("personalizeBanner.dismiss")}
      />
    </TopBannerSlot>
  );
}
