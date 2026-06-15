import { useState } from "react";
import { Box, Text } from "@mantine/core";
import { Link, useLocation } from "@tanstack/react-router";
import { IconAdjustments, IconSparkles } from "@tabler/icons-react";
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
 * A nudge pointing users at /personalize, which unlocks requirement-aware
 * schedules and recommendations. Gates on app data being loaded.
 *
 * The floating variant is a dismissible top-of-page pill shown only to
 * not-yet-personalized users (returns null once personalized): rendered once in
 * the root layout (always mounted, so a dismissal sticks across navigation) and
 * self-gates on route. The sidebar variant is placed explicitly by its host and
 * persists after personalization, recast as a "change your personalization" link
 * (e.g. so a user can revisit their program/courses after a transcript import).
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
  if (!indices || dismissed || !onNudgeRoute) return null;

  if (variant === "sidebar") {
    // Once personalized, keep the entry point in place but recast it as a way to
    // revisit/change the saved program and completed courses (e.g. after a
    // transcript import) rather than a first-time nudge.
    return (
      <Box
        component={Link}
        to="/personalize"
        role="note"
        className={
          personalized
            ? `${classes.sidebarPill} ${classes.sidebarPillNeutral}`
            : classes.sidebarPill
        }
        data-testid="personalize-sidebar-nudge"
      >
        <Box
          aria-hidden
          style={{
            display: "flex",
            color: personalized ? "var(--app-text-muted)" : "var(--app-warning)",
            flexShrink: 0,
          }}
        >
          {personalized ? <IconAdjustments size={18} /> : <IconSparkles size={18} />}
        </Box>
        <Text size="sm" c="var(--app-text)" className={classes.sidebarText}>
          {personalized
            ? tr("personalizeBanner.changeShort")
            : tr("personalizeBanner.messageShort")}
        </Text>
      </Box>
    );
  }

  // The floating top-of-page variant stays a one-time nudge: hide it once the
  // user is personalized so it never becomes a permanent banner.
  if (personalized) return null;

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
