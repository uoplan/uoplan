import { useMemo } from "react";
import { pickCanonicalProfessorName } from "@uoplan/core";
import { resolveProfessorRoute } from "../../lib/explore/professorRoute";
import { useProfessorRegistry } from "@uoplan/store/hooks";
import { tr } from "../../i18n";
import { useProfessorFeedbackViews } from "../../hooks/useFeedbackViews";
import { useRedirectToExploreWhenNoFeedback } from "../../hooks/useRedirectToExploreWhenNoFeedback";
import { ExploreFeedbackContent } from "./feedback/ExploreFeedbackContent";

export function ExploreProfessorFeedbackPage({ slug }: { slug: string }) {
  const registry = useProfessorRegistry();
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
  useRedirectToExploreWhenNoFeedback(loading, views);

  const title =
    displayName ||
    resolved.displayName ||
    pickCanonicalProfessorName([tr("explore.professorFallback")]);

  return (
    <ExploreFeedbackContent title={title} views={views} questions={questions} loading={loading} />
  );
}
