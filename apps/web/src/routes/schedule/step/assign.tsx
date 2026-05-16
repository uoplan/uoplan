import { createFileRoute } from "@tanstack/react-router";
import { WizardAssignPage } from "../../../components/wizard/step-pages/WizardAssignPage";

export const Route = createFileRoute("/schedule/step/assign")({
  component: WizardAssignPage,
});
