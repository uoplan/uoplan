import { createFileRoute } from "@tanstack/react-router";
import { AppDataRouteGate } from "../../components/shared/AppDataRouteGate";
import { TrendsFilterProvider } from "../../components/trends/TrendsFilterProvider";
import { TrendsLayout } from "../../components/trends/TrendsLayout";
import { toUrlSearch, validateTrendsSearch } from "../../lib/trends/searchParams";

export const Route = createFileRoute("/trends")({
  validateSearch: validateTrendsSearch,
  component: TrendsLayoutRoute,
});

function TrendsLayoutRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppDataRouteGate requires={["grades", "disciplines"]}>
      <TrendsFilterProvider
        search={search}
        // Omitting `to` keeps the active sub-route's pathname; only the shared
        // filter search params change, so filters persist across pages.
        onChange={(next) =>
          navigate({ search: toUrlSearch(next), replace: true, resetScroll: false })
        }
      >
        <TrendsLayout />
      </TrendsFilterProvider>
    </AppDataRouteGate>
  );
}
