import { createFileRoute } from "@tanstack/react-router";
import { AssignEditorPage } from "../../components/schedule/AssignEditorPage";
import { buildTabTitle } from "../../lib/seo";

export const Route = createFileRoute("/schedule/requirements")({
  head: () => buildTabTitle("Fill requirements"),
  component: AssignEditorPage,
});
