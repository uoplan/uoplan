import { createFileRoute } from "@tanstack/react-router";
import { WizardCompletedPage } from "../../components/wizard/step-pages/WizardCompletedPage";

export const Route = createFileRoute("/step/completed")({
  component: WizardCompletedPage,
});
