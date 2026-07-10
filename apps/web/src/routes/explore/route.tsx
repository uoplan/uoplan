import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";
import { ExploreLayout } from "../../components/explore/ExploreLayout";
import { ExploreOfferingsProvider } from "../../components/explore/ExploreOfferingsProvider";
import { useCatalogue, useProfessorRatings, useProfessorRegistry } from "@uoplan/store/hooks";
import { validateExploreSearch } from "../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore")({
  validateSearch: validateExploreSearch,
  component: ExploreLayoutRoute,
});

function ExploreLayoutRoute() {
  const catalogue = useCatalogue();
  const professorRatings = useProfessorRatings();
  const professors = useProfessorRegistry();

  return (
    <AppDataRouteGate requires={["grades", "ratings", "disciplines", "professors"]}>
      <ExploreOfferingsProvider
        catalogue={catalogue}
        professorRatings={professorRatings}
        registry={professors}
      >
        <ExploreLayout>
          <Outlet />
        </ExploreLayout>
      </ExploreOfferingsProvider>
    </AppDataRouteGate>
  );
}
