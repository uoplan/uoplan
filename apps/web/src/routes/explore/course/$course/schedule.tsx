import { createFileRoute } from "@tanstack/react-router";
import { ExploreCourseSchedulePage } from "../../../../components/explore/ExploreCourseSchedulePage";
import { parseCoursePathParam } from "../../../../lib/explore/courseSearchParams";

export const Route = createFileRoute("/explore/course/$course/schedule")({
  head: ({ params }) => {
    const code = parseCoursePathParam(params.course) ?? params.course.toUpperCase();
    return { meta: [{ title: `${code} schedule` }] };
  },
  component: ExploreCourseScheduleRoute,
});

function ExploreCourseScheduleRoute() {
  const { course } = Route.useParams();
  const { term } = Route.useSearch();
  return <ExploreCourseSchedulePage urlCourseParam={course} termId={term ?? null} />;
}
