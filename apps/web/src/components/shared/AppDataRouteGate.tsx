import { Alert, Box } from "@mantine/core";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { tr, useTr } from "../../i18n";
import { useDataset, useLazyData, useLoadData, useStoreApi } from "@uoplan/store/hooks";
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
  requires?: readonly ("grades" | "ratings" | "disciplines" | "professors")[];
  /** Pre-warm the schedule worker once the core data is loaded. */
  prewarm?: boolean;
}) {
  useTr();

  const storeApi = useStoreApi();
  const { loadProgress, error, cache } = useDataset();
  const hasBooted = Boolean(cache);

  const loadData = useLoadData();
  const { ensureCourseGrades, ensureProfessorRatings, ensureDisciplines, ensureProfessors } =
    useLazyData();

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
    if (assets.includes("professors")) void ensureProfessors();
  }, [
    hasBooted,
    requiresKey,
    ensureCourseGrades,
    ensureProfessorRatings,
    ensureDisciplines,
    ensureProfessors,
  ]);

  useEffect(() => {
    if (!hasBooted || !prewarm || typeof window === "undefined") return;
    void (async () => {
      const { prewarmScheduleWorker } = await import("../../workers/scheduleWorkerClient");
      await prewarmScheduleWorker(storeApi.getState());
    })();
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
