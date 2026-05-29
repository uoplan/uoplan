import { createFileRoute } from "@tanstack/react-router";
import { ScheduleDashboardPage } from "../../components/schedule/ScheduleDashboardPage";
import { buildPageHead } from "../../lib/seo";
import { isScheduleStepId, type ScheduleStepId } from "../../lib/scheduleDashboard";

type ScheduleSearch = {
  step?: ScheduleStepId;
};

export const Route = createFileRoute("/schedule/")({
  validateSearch: (search: Record<string, unknown>): ScheduleSearch => ({
    step: isScheduleStepId(search.step) ? search.step : undefined,
  }),
  head: () => buildPageHead("schedule"),
  component: ScheduleDashboardPage,
});
