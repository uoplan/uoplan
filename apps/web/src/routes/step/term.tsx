import { createFileRoute } from "@tanstack/react-router";
import { WizardTermPage } from "../../components/wizard/step-pages/WizardTermPage";
import { buildPageHead } from "../../lib/seo";

export const Route = createFileRoute("/step/term")({
  head: () => buildPageHead("schedule"),
  component: WizardTermPage,
});
