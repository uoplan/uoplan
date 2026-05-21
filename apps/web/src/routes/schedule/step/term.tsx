import { createFileRoute } from "@tanstack/react-router";
import { WizardTermPage } from "../../../components/wizard/step-pages/WizardTermPage";
import { buildTabTitle } from "../../../lib/seo";

export const Route = createFileRoute("/schedule/step/term")({
  head: () => buildTabTitle("Select term"),
  component: WizardTermPage,
});
