import { createFileRoute } from "@tanstack/react-router";
import { ProfessorGraphPage } from "../components/graph/ProfessorGraphPage";

export const Route = createFileRoute("/graph")({
  component: ProfessorGraphPage,
});
