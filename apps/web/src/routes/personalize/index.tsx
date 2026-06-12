import { createFileRoute } from "@tanstack/react-router";
import { ScheduleDashboardPage } from "../../components/schedule/ScheduleDashboardPage";
import { buildPageHead } from "../../lib/seo";
import { isScheduleStepId } from "../../lib/scheduleDashboard";
import type { ScheduleStepId } from "../../lib/scheduleDashboard";

type PersonalizeSearch = {
  step?: ScheduleStepId;
};

export const Route = createFileRoute("/personalize/")({
  validateSearch: (search: Record<string, unknown>): PersonalizeSearch => ({
    step: isScheduleStepId(search.step) ? search.step : undefined,
  }),
  head: () => buildPageHead("personalize"),
  component: ScheduleDashboardPage,
});
