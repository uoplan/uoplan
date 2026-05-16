import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import {
  ExploreSearchPage,
  type ExploreSearchNavigate,
} from "../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../store/appStore";

export const Route = createFileRoute("/explore/")({
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

  return (
    <ExploreSearchPage
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      navigateExplore={navigate as ExploreSearchNavigate}
    />
  );
}
