import { createFileRoute } from "@tanstack/react-router";
import { TrendsCoursesPage } from "../../components/trends/TrendsCoursesPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/trends/courses")({
  head: () => buildPageHead("trendsCourses"),
  component: TrendsCoursesPage,
});
