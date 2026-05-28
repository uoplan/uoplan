import { createFileRoute } from "@tanstack/react-router";
import { OptionsEditorPage } from "../../components/schedule/OptionsEditorPage";
import { buildTabTitle } from "../../lib/seo";

export const Route = createFileRoute("/schedule/options")({
  head: () => buildTabTitle("Program options"),
  component: OptionsEditorPage,
});
