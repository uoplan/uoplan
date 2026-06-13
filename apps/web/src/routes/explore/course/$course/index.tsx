import { createFileRoute } from "@tanstack/react-router";
import { ExploreCoursePage } from "../../../../components/explore/ExploreCoursePage";
import { parseCoursePathParam } from "../../../../lib/explore/courseSearchParams";
import { useProfessorRatings } from "../../../../store/hooks";

export const Route = createFileRoute("/explore/course/$course/")({
  head: ({ params }) => ({
    meta: [{ title: parseCoursePathParam(params.course) ?? params.course.toUpperCase() }],
  }),
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const professorRatings = useProfessorRatings();

  const { course } = Route.useParams();

  return <ExploreCoursePage urlCourseParam={course} professorRatings={professorRatings} />;
}
