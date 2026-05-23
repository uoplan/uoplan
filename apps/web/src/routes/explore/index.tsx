import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../components/explore/ExploreLayout";
import { ExploreSearchPage } from "../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../store/appStore";
import { buildPageHead } from "../../lib/seo";
import { validateExploreSearch } from "../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore/")({
  validateSearch: validateExploreSearch,
  head: () => buildPageHead("explore"),
  component: ExploreRoute,
});

function ExploreRoute() {
  const { catalogue, terms, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      terms: s.terms,
      professorRatings: s.professorRatings,
    })),
  );

  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  return (
    <ExploreLayout
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      searchParams={search}
      onQueryChange={(_, nextSearch) =>
        void navigate({
          search: nextSearch,
          replace: true,
        })
      }
    >
      <ExploreSearchPage catalogue={catalogue} searchParams={search} />
    </ExploreLayout>
  );
}
