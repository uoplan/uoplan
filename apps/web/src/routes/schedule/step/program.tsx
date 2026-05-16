import { createFileRoute } from "@tanstack/react-router";
import { WizardProgramPage } from "../../../components/wizard/step-pages/WizardProgramPage";

export const Route = createFileRoute("/schedule/step/program")({
  component: WizardProgramPage,
});
