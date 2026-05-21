import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreLayout } from "../../../components/explore/ExploreLayout";
import { ExploreDisciplinePage } from "../../../components/explore/ExploreDisciplinePage";
import { useAppStore } from "../../../store/appStore";
import { validateExploreSearch } from "../../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore/discipline/$discipline")({
  validateSearch: validateExploreSearch,
  component: ExploreDisciplineRoute,
});

function ExploreDisciplineRoute() {
  const { catalogue, terms, professorRatings, disciplines } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      terms: s.terms,
      professorRatings: s.professorRatings,
      disciplines: s.disciplines,
    })),
  );

  const { discipline } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ExploreLayout
      showBackButton
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      searchParams={search}
      onQueryChange={(v, nextSearch) => {
        if (v.length > 0) {
          void navigate({ to: "/explore", search: nextSearch });
        }
      }}
    >
      <ExploreDisciplinePage
        disciplineCode={discipline}
        disciplines={disciplines}
        catalogue={catalogue}
        terms={terms ?? []}
        professorRatings={professorRatings}
      />
    </ExploreLayout>
  );
}
