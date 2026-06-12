import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";

export const Route = createFileRoute("/personalize")({
  component: PersonalizeLayoutRoute,
});

function PersonalizeLayoutRoute() {
  return (
    <AppDataRouteGate requires={["ratings", "disciplines"]} prewarm>
      <Outlet />
    </AppDataRouteGate>
  );
}
