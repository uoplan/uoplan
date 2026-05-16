import { createFileRoute } from "@tanstack/react-router";
import { WizardOptionsPage } from "../../components/wizard/step-pages/WizardOptionsPage";

export const Route = createFileRoute("/step/options")({
  component: WizardOptionsPage,
});
