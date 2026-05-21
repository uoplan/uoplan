import { createFileRoute } from "@tanstack/react-router";
import { WizardAssignPage } from "../../../components/wizard/step-pages/WizardAssignPage";
import { buildTabTitle } from "../../../lib/seo";

export const Route = createFileRoute("/schedule/step/assign")({
  head: () => buildTabTitle("Add courses"),
  component: WizardAssignPage,
});
