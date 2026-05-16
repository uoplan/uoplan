import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreSearchPage } from "../../../components/explore/ExploreSearchPage";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/course/$course")({
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const { catalogue, terms, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      terms: s.terms,
      professorRatings: s.professorRatings,
    })),
  );

  const navigate = Route.useNavigate();
  const { course } = Route.useParams();

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
