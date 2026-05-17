import { createRootRoute, HeadContent, Link, Outlet } from "@tanstack/react-router";
import { buildRootHead } from "../lib/seo";
import { useCallback, useEffect, useState } from "react";
import { useLingui } from "@lingui/react";
import { Box, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { motion } from "framer-motion";
import { usePersistState } from "../hooks/usePersistState";
import { useAppStore } from "../store/appStore";
import { dynamicActivate, tr, type AppLocale } from "../i18n";
import { AppFooter } from "../components/shared/AppFooter";
import { LanguageSwitcher } from "../components/shared/LanguageSwitcher";

export const Route = createRootRoute({
  head: () => buildRootHead(),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function NotFound() {
  useLingui();

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        backgroundColor: "#141517",
      }}
    >
      <Text c="dimmed" size="lg" fw={600}>
        Page not found
      </Text>
      <Text c="dimmed" size="sm" ta="center">
        This page does not exist.
      </Text>
      <Link to="/" style={{ color: "var(--mantine-color-violet-4)" }}>
        {tr("app.nav.back")} — uoplan
      </Link>
    </Box>
  );
}

function RootLayout() {
  const loadData = useAppStore((s) => s.loadData);
  const indices = useAppStore((s) => s.indices);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  usePersistState(!!indices);

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

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#141517",
      }}
    >
      <HeadContent />
      <Box
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <LanguageSwitcher onSwitch={handleLangSwitch} />
      </Box>
      <motion.div
        animate={{ opacity: isLangTransitioning ? 0 : 1 }}
        transition={{ duration: isLangTransitioning ? 0.13 : 0.2, ease: "easeInOut" }}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Box style={{ flex: 1 }}>
          <Outlet />
        </Box>
        <AppFooter />
      </motion.div>
    </Box>
  );
}
