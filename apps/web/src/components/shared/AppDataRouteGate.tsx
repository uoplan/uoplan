import { Alert, Box } from "@mantine/core";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTr, tr } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { AppDataLoader } from "./AppDataLoader";
import { AppCard } from "./AppCard";

export function AppDataRouteGate({ children }: { children: ReactNode }) {
  useTr();

  const { loadProgress, error, hasBooted } = useAppStore(
    useShallow((s) => ({
      loadProgress: s.loadProgress,
      error: s.error,
      hasBooted: Boolean(s.cache),
    })),
  );

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

  if (!hasBooted) {
    return <AppDataLoader progress={loadProgress} />;
  }

  return children;
}
