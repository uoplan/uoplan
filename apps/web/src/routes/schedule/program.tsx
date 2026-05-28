import { createFileRoute } from "@tanstack/react-router";
import { ProgramEditorPage } from "../../components/schedule/ProgramEditorPage";
import { buildTabTitle } from "../../lib/seo";

export const Route = createFileRoute("/schedule/program")({
  head: () => buildTabTitle("Select program"),
  component: ProgramEditorPage,
});
