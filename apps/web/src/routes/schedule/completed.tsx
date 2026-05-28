import { createFileRoute } from "@tanstack/react-router";
import { CompletedEditorPage } from "../../components/schedule/CompletedEditorPage";
import { buildTabTitle } from "../../lib/seo";

export const Route = createFileRoute("/schedule/completed")({
  head: () => buildTabTitle("Completed courses"),
  component: CompletedEditorPage,
});
