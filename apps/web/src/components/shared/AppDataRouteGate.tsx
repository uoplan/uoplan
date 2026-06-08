import { Alert, Box } from "@mantine/core";
import { type ReactNode, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTr, tr } from "../../i18n";
import { useAppStore, useAppStoreApi } from "../../store/appStore";
import { AppDataLoader } from "./AppDataLoader";
import { AppCard } from "./AppCard";

/**
 * Boots the core dataset on first mount of any data-gated route, and optionally
 * pulls in the secondary assets (`grades.pb` / `ratemyprofessors.pb` /
 * `disciplines.pb`) a route declares through {@link requires}. The landing page
 * renders no gate, so visiting `/` fetches no `.pb` data at all.
 */
export function AppDataRouteGate({
  children,
  requires,
  prewarm = false,
}: {
  children: ReactNode;
  requires?: readonly ("grades" | "ratings" | "disciplines")[];
  /** Pre-warm the schedule worker once the core data is loaded. */
  prewarm?: boolean;
}) {
  useTr();

  const storeApi = useAppStoreApi();
  const { loadProgress, error, hasBooted } = useAppStore(
    useShallow((s) => ({
      loadProgress: s.loadProgress,
      error: s.error,
      hasBooted: Boolean(s.cache),
    })),
  );

  const loadData = useAppStore((s) => s.loadData);
  const ensureCourseGrades = useAppStore((s) => s.ensureCourseGrades);
  const ensureProfessorRatings = useAppStore((s) => s.ensureProfessorRatings);
  const ensureDisciplines = useAppStore((s) => s.ensureDisciplines);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requiresKey = requires ? [...requires].sort().join(",") : "";
  useEffect(() => {
    if (!hasBooted || requiresKey === "") return;
    const assets = requiresKey.split(",");
    if (assets.includes("grades")) void ensureCourseGrades();
    if (assets.includes("ratings")) void ensureProfessorRatings();
    if (assets.includes("disciplines")) void ensureDisciplines();
  }, [hasBooted, requiresKey, ensureCourseGrades, ensureProfessorRatings, ensureDisciplines]);

  useEffect(() => {
    if (!hasBooted || !prewarm || typeof window === "undefined") return;
    void import("../../workers/scheduleWorkerClient").then(({ prewarmScheduleWorker }) =>
      prewarmScheduleWorker(storeApi.getState()),
    );
  }, [hasBooted, prewarm, storeApi]);

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
