import { createFileRoute } from "@tanstack/react-router";
import { WizardGeneratePage } from "../../components/wizard/step-pages/WizardGeneratePage";

export const Route = createFileRoute("/step/generate")({
  component: WizardGeneratePage,
});
