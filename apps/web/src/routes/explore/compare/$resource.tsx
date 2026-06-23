import { createFileRoute } from "@tanstack/react-router";
import { ExploreComparePage } from "../../../components/explore/compare/ExploreComparePage";

type CompareSearch = { ids: string | undefined };

export const Route = createFileRoute("/explore/compare/$resource")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    ids: typeof search.ids === "string" && search.ids.length > 0 ? search.ids : undefined,
  }),
  component: ExploreCompareRoute,
});

function ExploreCompareRoute() {
  const { resource } = Route.useParams();
  const { ids } = Route.useSearch();
  const parsed = ids
    ? ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return <ExploreComparePage resource={resource} ids={parsed} />;
}
