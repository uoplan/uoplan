import { createFileRoute } from "@tanstack/react-router";
import { WizardCompletedPage } from "../../../components/wizard/step-pages/WizardCompletedPage";
import { buildTabTitle } from "../../../lib/seo";

export const Route = createFileRoute("/schedule/step/completed")({
  head: () => buildTabTitle("Review"),
  component: WizardCompletedPage,
});
