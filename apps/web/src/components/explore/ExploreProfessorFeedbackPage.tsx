import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { tr } from "../../i18n";
import { useProfessorFeedbackViews } from "../../hooks/useFeedbackViews";
import { ExploreFeedbackContent } from "./feedback/ExploreFeedbackContent";

export function ExploreProfessorFeedbackPage({
  legacyId,
  professorName: professorNameProp,
}:
  | { legacyId: number; professorName?: undefined }
  | { professorName: string; legacyId?: undefined }) {
  const arg = legacyId != null ? { legacyId } : { professorName: professorNameProp ?? "" };
  const { views, questions, loading, displayName } = useProfessorFeedbackViews(arg);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (views.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, views, navigate]);

  const title = displayName || tr("explore.professorFallback");

  return (
    <ExploreFeedbackContent title={title} views={views} questions={questions} loading={loading} />
  );
}
