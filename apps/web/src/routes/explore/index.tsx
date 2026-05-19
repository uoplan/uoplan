import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../components/explore/ExploreLayout";
import { ExploreSearchPage } from "../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../store/appStore";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/explore/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
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
  const { q } = Route.useSearch();

  return (
    <ExploreLayout
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      initialQuery={q ?? ""}
      onQueryChange={(v) =>
        void navigate({
          search: { q: v.length > 0 ? v : undefined },
          replace: true,
        })
      }
    >
      <ExploreSearchPage catalogue={catalogue} terms={terms ?? []} />
    </ExploreLayout>
  );
}
