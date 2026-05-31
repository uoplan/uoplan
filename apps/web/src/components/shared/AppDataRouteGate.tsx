import { Alert, Box } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { tr } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { AppDataLoader } from "./AppDataLoader";
import { AppCard } from "./AppCard";

export function AppDataRouteGate({ children }: { children: ReactNode }) {
  useLingui();

  const { loading, loadProgress, error, hasBooted } = useAppStore(
    useShallow((s) => ({
      loading: s.loading,
      loadProgress: s.loadProgress,
      error: s.error,
      hasBooted: Boolean(s.cache),
    })),
  );

  if (loading && !hasBooted) {
    return <AppDataLoader progress={loadProgress} />;
  }

  if (error) {
    return (
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
        <AppCard
          p={32}
          style={{
            maxWidth: 480,
            width: "100%",
          }}
        >
          <Alert color="red" title={tr("app.errorTitle")}>
            {error}
          </Alert>
        </AppCard>
      </Box>
    );
  }

  return children;
}
