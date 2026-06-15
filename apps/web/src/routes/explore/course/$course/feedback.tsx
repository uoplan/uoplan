import { createFileRoute } from "@tanstack/react-router";
import { ExploreCourseFeedbackPage } from "../../../../components/explore/ExploreCourseFeedbackPage";
import { parseCoursePathParam } from "../../../../lib/explore/courseSearchParams";

export const Route = createFileRoute("/explore/course/$course/feedback")({
  head: ({ params }) => {
    const code = parseCoursePathParam(params.course) ?? params.course.toUpperCase();
    return { meta: [{ title: `${code} feedback` }] };
  },
  component: ExploreCourseFeedbackRoute,
});

function ExploreCourseFeedbackRoute() {
  const { course } = Route.useParams();
  return <ExploreCourseFeedbackPage urlCourseParam={course} />;
}
