import { createFileRoute } from "@tanstack/react-router";
import {
  ProfessorGraphPage,
  type ProfessorGraphNavigate,
} from "../components/graph/ProfessorGraphPage";

export const Route = createFileRoute("/graph")({
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

  return <ProfessorGraphPage urlProfParam={prof} navigateGraph={navigateGraph} />;
}
