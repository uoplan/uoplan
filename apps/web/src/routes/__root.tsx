import { createRootRoute, HeadContent, Link, Outlet } from "@tanstack/react-router";
import { buildRootHead } from "../lib/seo";
import { useEffect } from "react";
import { useLingui } from "@lingui/react";
import { Box, Text } from "@mantine/core";
import { usePersistState } from "../hooks/usePersistState";
import { useAppStore } from "../store/appStore";
import { tr } from "../i18n";

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

  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
