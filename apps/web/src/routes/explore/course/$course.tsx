import { createFileRoute } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { ExploreCoursePage } from "../../../components/explore/ExploreCoursePage";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/course/$course")({
  head: ({ params }) => ({ meta: [{ title: params.course.toUpperCase() }] }),
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const { catalogue, professorRatings } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      professorRatings: s.professorRatings,
    })),
  );

  const { course } = Route.useParams();

  return (
    <ExploreCoursePage
      urlCourseParam={course}
      catalogue={catalogue}
      professorRatings={professorRatings}
    />
  );
}
