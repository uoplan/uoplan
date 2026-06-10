import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { resolveProfessorRoute } from "../../lib/explore/professorRoute";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { useProfessorFeedbackViews } from "../../hooks/useFeedbackViews";
import { ExploreFeedbackContent } from "./feedback/ExploreFeedbackContent";

export function ExploreProfessorFeedbackPage({ slug }: { slug: string }) {
  const registry = useAppStore(useShallow((s) => s.professors));
  const resolved = useMemo(() => resolveProfessorRoute(registry, slug), [registry, slug]);

  const arg = useMemo(
    () =>
      resolved.index != null
        ? { professorRef: resolved.index }
        : resolved.legacyId != null
          ? { legacyId: resolved.legacyId }
          : { professorName: resolved.displayName },
    [resolved.index, resolved.legacyId, resolved.displayName],
  );
  const { views, questions, loading, displayName } = useProfessorFeedbackViews(arg);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (views.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, views, navigate]);

  const title = displayName || resolved.displayName || tr("explore.professorFallback");

  return (
    <ExploreFeedbackContent title={title} views={views} questions={questions} loading={loading} />
  );
}
