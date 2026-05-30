import { createFileRoute } from "@tanstack/react-router";
import { ExploreSearchPage } from "../../components/explore/ExploreSearchPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/explore/")({
  head: () => buildPageHead("explore"),
  component: ExploreRoute,
});

function ExploreRoute() {
  const search = Route.useSearch();

  return <ExploreSearchPage searchParams={search} />;
}
