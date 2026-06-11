import { createFileRoute, useLocation } from "@tanstack/react-router";
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
  // Pin navigation to the *current* pathname. A Route-scoped navigate with no
  // `to` resolves against `from: "/trends"`, which redirects sub-pages (e.g.
  // /trends/courses) back to the hub. Passing the live pathname as `to` keeps
  // the active sub-route while only the shared filter search params change.
  const pathname = useLocation({ select: (s) => s.pathname });

  return (
    <AppDataRouteGate requires={["grades", "disciplines"]}>
      <TrendsFilterProvider
        search={search}
        onChange={(next) =>
          navigate({
            to: pathname,
            search: toUrlSearch(next),
            replace: true,
            resetScroll: false,
          })
        }
      >
        <TrendsLayout />
      </TrendsFilterProvider>
    </AppDataRouteGate>
  );
}
