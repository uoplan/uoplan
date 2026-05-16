import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";
import { RouteEnterTransition } from "../../components/shared/RouteEnterTransition";

export const Route = createFileRoute("/explore")({
  component: ExploreLayoutRoute,
});

function ExploreLayoutRoute() {
  return (
    <AppDataRouteGate>
      <RouteEnterTransition>
        <Outlet />
      </RouteEnterTransition>
    </AppDataRouteGate>
  );
}
