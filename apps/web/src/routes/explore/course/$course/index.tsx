import { createFileRoute } from "@tanstack/react-router";
import { ExploreCoursePage } from "../../../../components/explore/ExploreCoursePage";
import {
  courseNormToPathParam,
  parseCoursePathParam,
} from "../../../../lib/explore/courseSearchParams";
import { buildCourseHead } from "../../../../lib/seo";
import { useProfessorRatings } from "../../../../store/hooks";

export const Route = createFileRoute("/explore/course/$course/")({
  head: ({ params }) => {
    const courseCode = parseCoursePathParam(params.course);
    return buildCourseHead({
      courseCode: courseCode ?? params.course.toUpperCase(),
      pathParam: courseCode ? courseNormToPathParam(courseCode) : params.course,
    });
  },
  component: ExploreCourseRoute,
});

function ExploreCourseRoute() {
  const professorRatings = useProfessorRatings();

  const { course } = Route.useParams();

  return <ExploreCoursePage urlCourseParam={course} professorRatings={professorRatings} />;
}
