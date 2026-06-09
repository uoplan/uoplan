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
  const { catalogue, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      professorRatings: s.professorRatings,
    })),
  );

  return (
    <AppDataRouteGate requires={["grades", "ratings", "disciplines"]}>
      <ExploreOfferingsProvider catalogue={catalogue} professorRatings={professorRatings}>
        <ExploreLayout>
          <Outlet />
        </ExploreLayout>
      </ExploreOfferingsProvider>
    </AppDataRouteGate>
  );
}
