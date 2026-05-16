import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreSearchPage } from "../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../store/appStore";

export const Route = createFileRoute("/explore/")({
  validateSearch: (search: Record<string, unknown>) => ({
    course:
      typeof search.course === "string" && search.course.trim().length > 0
        ? search.course.trim()
        : undefined,
  }),
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
  const { course } = Route.useSearch();

  return (
    <ExploreSearchPage
      catalogue={catalogue}
      terms={terms ?? []}
      professorRatings={professorRatings}
      navigateExplore={navigate}
      urlCourseParam={course}
    />
  );
}
