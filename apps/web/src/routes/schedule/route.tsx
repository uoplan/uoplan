import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";

export const Route = createFileRoute("/schedule")({
  component: ScheduleLayoutRoute,
});

function ScheduleLayoutRoute() {
  return (
    <AppDataRouteGate requires={["ratings", "disciplines"]} prewarm>
      <Outlet />
    </AppDataRouteGate>
  );
}
