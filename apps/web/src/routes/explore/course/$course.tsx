import { createFileRoute } from "@tanstack/react-router";
import { ExploreCoursePage } from "../../../components/explore/ExploreCoursePage";
import { parseCoursePathParam } from "../../../lib/explore/courseSearchParams";
import { useAppStore } from "../../../store/appStore";

export const Route = createFileRoute("/explore/course/$course")({
  head: ({ params }) => ({
    meta: [{ title: parseCoursePathParam(params.course) ?? params.course.toUpperCase() }],
  }),
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const professorRatings = useAppStore((s) => s.professorRatings);

  const { course } = Route.useParams();

  return <ExploreCoursePage urlCourseParam={course} professorRatings={professorRatings} />;
}
