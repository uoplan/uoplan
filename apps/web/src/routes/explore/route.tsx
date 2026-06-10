import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";
import { ExploreLayout } from "../../components/explore/ExploreLayout";
import { ExploreOfferingsProvider } from "../../components/explore/ExploreOfferingsProvider";
import { useAppStore } from "../../store/appStore";
import { validateExploreSearch } from "../../lib/explore/exploreFilters";

export const Route = createFileRoute("/explore")({
  validateSearch: validateExploreSearch,
  component: ExploreLayoutRoute,
});

function ExploreLayoutRoute() {
  const { catalogue, professorRatings, professors } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      professorRatings: s.professorRatings,
      professors: s.professors,
    })),
  );

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
