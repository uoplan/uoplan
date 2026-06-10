import { useMemo } from "react";
import {
  normalizeCourseCode,
  normalizeProfessorName,
  type FeedbackQuestionMeta,
  type FeedbackSectionView,
} from "@uoplan/core";
import { resolveComponentId } from "../lib/explore/gradesSearch";
import { parseCoursePathParam } from "../lib/explore/courseSearchParams";
import { useExploreOfferings } from "../components/explore/exploreOfferingsContext";
import { useFeedbackData } from "./useFeedbackData";

interface FeedbackViews {
  views: FeedbackSectionView[];
  questions: FeedbackQuestionMeta[];
  loading: boolean;
}

const normSection = (section: string | undefined): string => (section ?? "").trim().toUpperCase();

/**
 * Gather every feedback section view for a course (resolving alias / cross-listed
 * codes so they all contribute), keyed off the URL course param. Shared by the
 * course feedback page and the summary card on the course page.
 */
export function useCourseFeedbackViews(urlCourseParam: string): FeedbackViews & {
  urlNorm: string | null;
} {
  const { data: feedback, loading: feedbackLoading } = useFeedbackData();
  const { loading: offeringsLoading, aliasGroups } = useExploreOfferings();

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const componentId = useMemo(
    () => (urlNorm === null ? null : resolveComponentId(urlNorm, aliasGroups.componentByNorm)),
    [urlNorm, aliasGroups],
  );

  const memberNorms = useMemo(() => {
    if (urlNorm === null) return [];
    if (componentId === null) return [urlNorm];
    return aliasGroups.membersByComponent.get(componentId) ?? [urlNorm];
  }, [urlNorm, componentId, aliasGroups]);

  const views = useMemo<FeedbackSectionView[]>(() => {
    if (!feedback) return [];
    const out: FeedbackSectionView[] = [];
    for (const norm of memberNorms) {
      const bucket = feedback.byCourseNorm.get(norm);
      if (bucket) out.push(...bucket);
    }
    return out;
  }, [feedback, memberNorms]);

  return {
    views,
    questions: feedback?.questions ?? [],
    loading: feedbackLoading || offeringsLoading,
    urlNorm,
  };
}

/**
 * Gather every feedback section view taught by a professor. Robust join: the
 * professor's offerings give `(courseNorm, termId, section)` triples that map to
 * feedback sections, with a normalized-name match as a fallback. Shared by the
 * professor feedback page and the summary card on the professor page.
 */
export function useProfessorFeedbackViews(
  arg:
    | { professorRef: number; legacyId?: undefined; professorName?: undefined }
    | { legacyId: number; professorRef?: undefined; professorName?: undefined }
    | { professorName: string; professorRef?: undefined; legacyId?: undefined },
): FeedbackViews & { displayName: string } {
  const { professorRef, legacyId, professorName: professorNameProp } = arg;
  const { data: feedback, loading: feedbackLoading } = useFeedbackData();
  const { offerings, loading: offeringsLoading } = useExploreOfferings();

  const professorOfferings = useMemo(() => {
    if (professorRef != null) return offerings.filter((o) => o.professorRef === professorRef);
    if (legacyId != null) return offerings.filter((o) => o.legacyId === legacyId);
    const nameLower = professorNameProp?.toLowerCase() ?? "";
    return offerings.filter((o) => o.professorName.toLowerCase() === nameLower);
  }, [offerings, professorRef, legacyId, professorNameProp]);

  const displayName = professorOfferings[0]?.professorName ?? professorNameProp ?? "";

  const views = useMemo<FeedbackSectionView[]>(() => {
    if (!feedback) return [];
    const keySet = new Set<string>();
    const courseNorms = new Set<string>();
    for (const o of professorOfferings) {
      const norm = normalizeCourseCode(o.courseCode);
      courseNorms.add(norm);
      keySet.add(`${norm}|${o.termId}|${normSection(o.section)}`);
    }
    const nameKey = normalizeProfessorName(displayName);

    const out: FeedbackSectionView[] = [];
    const seen = new Set<FeedbackSectionView>();
    for (const norm of courseNorms) {
      const bucket = feedback.byCourseNorm.get(norm);
      if (!bucket) continue;
      for (const view of bucket) {
        if (seen.has(view)) continue;
        const keyMatch = keySet.has(`${norm}|${view.termId}|${normSection(view.section)}`);
        const nameMatch = nameKey !== "" && normalizeProfessorName(view.professorName) === nameKey;
        if (keyMatch || nameMatch) {
          out.push(view);
          seen.add(view);
        }
      }
    }
    return out;
  }, [feedback, professorOfferings, displayName]);

  return {
    views,
    questions: feedback?.questions ?? [],
    loading: feedbackLoading || offeringsLoading,
    displayName,
  };
}
