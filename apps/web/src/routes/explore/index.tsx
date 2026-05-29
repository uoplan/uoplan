import { createFileRoute } from "@tanstack/react-router";
import { ExploreSearchPage } from "../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../store/appStore";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/explore/")({
  head: () => buildPageHead("explore"),
  component: ExploreRoute,
});

function ExploreRoute() {
  const catalogue = useAppStore((s) => s.catalogue);
  const search = Route.useSearch();

  return <ExploreSearchPage catalogue={catalogue} searchParams={search} />;
}
