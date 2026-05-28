import { createFileRoute } from "@tanstack/react-router";
import { ScheduleDashboardPage } from "../../components/schedule/ScheduleDashboardPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/schedule/")({
  head: () => buildPageHead("schedule"),
  component: ScheduleDashboardPage,
});
