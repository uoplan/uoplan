import { createFileRoute } from "@tanstack/react-router";
import { WizardProgramPage } from "../../../components/wizard/step-pages/WizardProgramPage";
import { buildTabTitle } from "../../../lib/seo";

export const Route = createFileRoute("/schedule/step/program")({
  head: () => buildTabTitle("Select program"),
  component: WizardProgramPage,
});
