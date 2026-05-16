import { createFileRoute } from "@tanstack/react-router";
import { WizardModePage } from "../../../components/wizard/step-pages/WizardModePage";

export const Route = createFileRoute("/schedule/step/mode")({
  component: WizardModePage,
});
