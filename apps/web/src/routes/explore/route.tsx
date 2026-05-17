import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";
import { RouteEnterTransition } from "../../components/shared/RouteEnterTransition";
import { ExploreHistoryProvider } from "../../components/explore/ExploreHistoryContext";

export const Route = createFileRoute("/explore")({
  component: ExploreLayoutRoute,
});

function ExploreLayoutRoute() {
  return (
    <AppDataRouteGate>
      <RouteEnterTransition>
        <ExploreHistoryProvider>
          <Outlet />
        </ExploreHistoryProvider>
      </RouteEnterTransition>
    </AppDataRouteGate>
  );
}
