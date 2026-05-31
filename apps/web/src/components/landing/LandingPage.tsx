import { useLingui } from "@lingui/react";
import { Box, SimpleGrid, Stack, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAffiliate, IconCalendar, IconChartHistogram, IconCompass } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";
import { ChromeControls } from "../shared/ChromeControls";
import { ExperimentalCarousel } from "./ExperimentalCarousel";
import { LandingTile } from "./LandingTile";

export function LandingPage() {
  useLingui();

  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [isLangTransitioning, setIsLangTransitioning] = useState(false);

  const handleLangSwitch = useCallback(
    async (locale: AppLocale) => {
      if (prefersReducedMotion) {
        await dynamicActivate(locale);
        return;
      }
      setIsLangTransitioning(true);
      await new Promise((r) => setTimeout(r, 130));
      await dynamicActivate(locale);
      setIsLangTransitioning(false);
    },
    [prefersReducedMotion],
  );

  const betaLabel = tr("app.beta");

  const experimentalFeatures = [
    {
      to: "/trends",
      title: tr("trends.title"),
      description: tr("landing.trends.description"),
      badgeLabel: betaLabel,
      badgeColor: "orange" as const,
      icon: <IconChartHistogram size={32} stroke={1.5} />,
      ariaLabel: `${tr("trends.title")}, ${betaLabel}`,
    },
    {
      to: "/graph",
      title: tr("graph.title"),
      description: tr("landing.graph.description"),
      badgeLabel: betaLabel,
      badgeColor: "orange" as const,
      icon: <IconAffiliate size={32} stroke={1.5} />,
      ariaLabel: `${tr("graph.title")}, ${betaLabel}`,
    },
  ];

  return (
    <motion.div
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
        <Box
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            width: "100%",
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
              ariaLabel={tr("landing.schedule.title")}
            />
            <LandingTile
              to="/explore"
              title={tr("explore.title")}
              description={tr("landing.explore.description")}
              icon={<IconCompass size={32} stroke={1.5} />}
              ariaLabel={tr("explore.title")}
            />
            <ExperimentalCarousel items={experimentalFeatures} />
          </SimpleGrid>
        </Stack>
      </Box>
    </motion.div>
  );
}
