import { Box, SimpleGrid, Stack, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAffiliate, IconCalendar, IconChartHistogram, IconCompass } from "@tabler/icons-react";
import { m } from "framer-motion";
import { useCallback, useState } from "react";
import { dynamicActivate, tr, useTr } from "../../i18n";
import type { AppLocale } from "../../i18n";
import { ChromeControls } from "../shared/ChromeControls";
import { DonationBanner } from "./DonationBanner";
import { ExperimentalCarousel } from "./ExperimentalCarousel";
import { LandingTile } from "./LandingTile";

export function LandingPage() {
  useTr();

  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);

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
          padding: 24,
          backgroundColor: "var(--app-bg)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <DonationBanner />

        <Box
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            width: "100%",
            maxWidth: 960,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <ChromeControls onLangSwitch={handleLangSwitch} />
        </Box>

        <Stack
          gap="xl"
          align="center"
          w="100%"
          maw={960}
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
              to="/schedule"
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
      </Box>
    </m.div>
  );
}
