import { createFileRoute } from "@tanstack/react-router";
import { WizardOptionsPage } from "../../../components/wizard/step-pages/WizardOptionsPage";

export const Route = createFileRoute("/schedule/step/options")({
  component: WizardOptionsPage,
});
