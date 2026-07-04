import { createFileRoute } from "@tanstack/react-router";
import { DegreePlannerPage } from "../../components/planner/DegreePlannerPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/schedule/graph")({
  head: () => buildPageHead("planner"),
  component: DegreePlannerRoute,
});

function DegreePlannerRoute() {
  return <DegreePlannerPage />;
}
