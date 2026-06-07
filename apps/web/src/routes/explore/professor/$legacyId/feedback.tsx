import { createFileRoute } from "@tanstack/react-router";
import { ExploreProfessorFeedbackPage } from "../../../../components/explore/ExploreProfessorFeedbackPage";

export const Route = createFileRoute("/explore/professor/$legacyId/feedback")({
  component: ExploreProfessorFeedbackRoute,
});

function ExploreProfessorFeedbackRoute() {
  const { legacyId } = Route.useParams();
  const parsed = Number.parseInt(legacyId, 10);
  const isNumeric = Number.isFinite(parsed) && parsed > 0;

  if (isNumeric) {
    return <ExploreProfessorFeedbackPage legacyId={parsed} />;
  }
  return <ExploreProfessorFeedbackPage professorName={decodeURIComponent(legacyId)} />;
}
