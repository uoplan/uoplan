import { createFileRoute } from "@tanstack/react-router";
import { WizardAssignPage } from "../../components/wizard/step-pages/WizardAssignPage";

export const Route = createFileRoute("/step/assign")({
  component: WizardAssignPage,
});
