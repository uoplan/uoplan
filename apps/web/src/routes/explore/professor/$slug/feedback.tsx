import { createFileRoute } from "@tanstack/react-router";
import { ExploreProfessorFeedbackPage } from "../../../../components/explore/ExploreProfessorFeedbackPage";

export const Route = createFileRoute("/explore/professor/$slug/feedback")({
  component: ExploreProfessorFeedbackRoute,
});

function ExploreProfessorFeedbackRoute() {
  const { slug } = Route.useParams();
  return <ExploreProfessorFeedbackPage slug={slug} />;
}
