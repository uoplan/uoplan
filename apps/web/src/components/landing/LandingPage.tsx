import { Link } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { Badge, Box, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAffiliate, IconCalendar, IconCompass } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useCallback, useState, type ReactNode } from "react";
import { dynamicActivate, tr, type AppLocale } from "../../i18n";
import { ChromeControls } from "../shared/ChromeControls";

type LandingTileProps = {
  to: string;
  title: string;
  description: string;
  badgeLabel?: string;
  badgeColor?: "blue" | "orange";
  icon: ReactNode;
  ariaLabel: string;
};

function LandingTile({
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

  const experimentalLabel = tr("app.experimental");

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
              fontFamily: '"DM Serif Display", serif',
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
            <LandingTile
              to="/graph"
              title={tr("graph.title")}
              description={tr("landing.graph.description")}
              badgeLabel={experimentalLabel}
              badgeColor="orange"
              icon={<IconAffiliate size={32} stroke={1.5} />}
              ariaLabel={`${tr("graph.title")}, ${experimentalLabel}`}
            />
          </SimpleGrid>
        </Stack>
      </Box>
    </motion.div>
  );
}
