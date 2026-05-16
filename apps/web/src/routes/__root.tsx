import { createRootRoute, HeadContent, Link, Outlet } from "@tanstack/react-router";
import { buildRootHead } from "../lib/seo";
import { useEffect, type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { Alert, Box, Paper, Text } from "@mantine/core";
import { AppDataLoader } from "../components/shared/AppDataLoader";
import { usePersistState } from "../hooks/usePersistState";
import { useAppStore } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
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
      <Link to="/step/term" style={{ color: "var(--mantine-color-violet-4)" }}>
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

  const { loading, loadProgress, error } = useAppStore(
    useShallow((s) => ({
      loading: s.loading,
      loadProgress: s.loadProgress,
      error: s.error,
    })),
  );

  let content: ReactNode;
  if (loading) {
    content = <AppDataLoader progress={loadProgress} />;
  } else if (error) {
    content = (
      <Box
        component="main"
        style={{
          minHeight: "100vh",
          padding: "60px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          withBorder
          style={{
            border: "2px solid #2C2E33",
            padding: 32,
            maxWidth: 480,
            width: "100%",
            backgroundColor: "#1E1E20",
          }}
        >
          <Alert color="red" title={tr("app.errorTitle")}>
            {error}
          </Alert>
        </Paper>
      </Box>
    );
  } else {
    content = <Outlet />;
  }

  return (
    <>
      <HeadContent />
      {content}
    </>
  );
}
