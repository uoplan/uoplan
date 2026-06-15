import { createFileRoute } from "@tanstack/react-router";
import { ProfessorGraphPage } from "../components/graph/ProfessorGraphPage";
import type { ProfessorGraphNavigate } from "../components/graph/ProfessorGraphPage";
import { AppDataRouteGate } from "../components/shared/AppDataRouteGate";
import { buildPageHead } from "../lib/seo";

export const Route = createFileRoute("/graph")({
  head: () => buildPageHead("graph"),
  validateSearch: (search: Record<string, unknown>) => ({
    prof:
      typeof search.prof === "string" && search.prof.trim().length > 0
        ? search.prof.trim()
        : undefined,
  }),
  component: GraphRoute,
});

function GraphRoute() {
  const navigate = Route.useNavigate();
  const { prof } = Route.useSearch();

  const navigateGraph: ProfessorGraphNavigate = (opts) =>
    navigate({ search: opts.search, replace: opts.replace });

  return (
    <AppDataRouteGate requires={["ratings", "grades"]}>
      <ProfessorGraphPage urlProfParam={prof} navigateGraph={navigateGraph} />
    </AppDataRouteGate>
  );
}
