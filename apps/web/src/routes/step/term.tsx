import { createFileRoute } from "@tanstack/react-router";
import { WizardTermPage } from "../../components/wizard/step-pages/WizardTermPage";

export const Route = createFileRoute("/step/term")({
  component: WizardTermPage,
});
