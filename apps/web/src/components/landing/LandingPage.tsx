import { Box, SimpleGrid, Stack, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAffiliate, IconCalendar, IconChartHistogram, IconCompass } from "@tabler/icons-react";
import { m } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { dynamicActivate, tr, useTr } from "../../i18n";
import type { AppLocale } from "../../i18n";
import { readPersistedPersonalized } from "../../lib/hasPersonalized";
import { useBasketCourses } from "../../hooks/useBasket";
import { useActiveProgram, useCompletedCourses } from "../../store/hooks";
import { ChromeControls } from "../shared/ChromeControls";
import { PageContainer } from "../shared/PageContainer";
import { ExperimentalCarousel } from "./ExperimentalCarousel";
import { LandingTile } from "./LandingTile";

export function LandingPage() {
  useTr();

  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);

  // Send first-time visitors through Personalize so the scheduler isn't an empty
  // shell; once they've set up a program, completed courses, or a basket, the tile
  // jumps straight to the generated schedule. The store is only resolved in-session
  // (app data isn't loaded on landing), so also peek persisted state for returning
  // visitors arriving on a fresh page load.
  const program = useActiveProgram();
  const { completedCourses } = useCompletedCourses();
  const basketCourses = useBasketCourses();
  const storePersonalized =
    program !== null || completedCourses.length > 0 || basketCourses.length > 0;
  const persistedPersonalized = useMemo(() => readPersistedPersonalized(), []);
  const scheduleTo = storePersonalized || persistedPersonalized ? "/schedule" : "/personalize";

  const handleLangSwitch = useCallback(
    async (locale: AppLocale) => {
      if (prefersReducedMotion) {
        await dynamicActivate(locale);
        return;
      }
      setIsLangTransitioning(true);
      await new Promise((resolve) => setTimeout(resolve, 130));
      await dynamicActivate(locale);
      setIsLangTransitioning(false);
    },
    [prefersReducedMotion],
  );

  const betaLabel = tr("app.beta");

  const experimentalIconColor = "var(--app-chart-4)";

  const experimentalFeatures = [
    {
      to: "/trends",
      title: tr("trends.title"),
      description: tr("landing.trends.description"),
      badgeLabel: betaLabel,
      badgeColor: "orange" as const,
      icon: <IconChartHistogram size={32} stroke={1.5} />,
      iconColor: experimentalIconColor,
      ariaLabel: `${tr("trends.title")}, ${betaLabel}`,
    },
    {
      to: "/graph",
      title: tr("graph.title"),
      description: tr("landing.graph.description"),
      badgeLabel: betaLabel,
      badgeColor: "orange" as const,
      icon: <IconAffiliate size={32} stroke={1.5} />,
      iconColor: experimentalIconColor,
      ariaLabel: `${tr("graph.title")}, ${betaLabel}`,
    },
  ];

  return (
    <m.div
      animate={{ opacity: isLangTransitioning ? 0 : 1 }}
      transition={{ duration: 0.13 }}
      style={{ width: "100%", minHeight: "100vh" }}
    >
      <Box
        component="main"
        style={{
          position: "relative",
          minHeight: "100vh",
          paddingBlock: 24,
          backgroundColor: "var(--app-bg)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <PageContainer style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Box style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
            <ChromeControls onLangSwitch={handleLangSwitch} />
          </Box>

          <Stack
            gap="xl"
            align="center"
            w="100%"
            pb={16}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <Title
              order={1}
              style={{
                fontFamily: "var(--app-font-heading)",
                color: "var(--app-text)",
                fontWeight: 400,
                fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
              }}
            >
              uoplan.party
            </Title>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" w="100%">
              <LandingTile
                to={scheduleTo}
                title={tr("landing.schedule.title")}
                description={tr("landing.schedule.description")}
                icon={<IconCalendar size={32} stroke={1.5} />}
                iconColor="var(--app-chart-1)"
                ariaLabel={tr("landing.schedule.title")}
              />
              <LandingTile
                to="/explore"
                title={tr("explore.title")}
                description={tr("landing.explore.description")}
                icon={<IconCompass size={32} stroke={1.5} />}
                iconColor="var(--app-chart-3)"
                ariaLabel={tr("explore.title")}
              />
              <ExperimentalCarousel items={experimentalFeatures} />
            </SimpleGrid>
          </Stack>
        </PageContainer>
      </Box>
    </m.div>
  );
}
