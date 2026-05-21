import { createFileRoute } from "@tanstack/react-router";
import { WizardOptionsPage } from "../../../components/wizard/step-pages/WizardOptionsPage";
import { buildTabTitle } from "../../../lib/seo";

export const Route = createFileRoute("/schedule/step/options")({
  head: () => buildTabTitle("Preferences"),
  component: WizardOptionsPage,
});
