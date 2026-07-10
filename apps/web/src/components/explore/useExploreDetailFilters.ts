import { useMemo } from "react";
import { useSearch } from "@tanstack/react-router";
import {
  courseSentimentByNorm,
  normalizeProfessorName,
  professorSentimentByName,
} from "@uoplan/core";
import { useCompletedCourses, useRequirementState } from "@uoplan/store/hooks";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import {
  buildRequirementCandidateSet,
  EMPTY_EXPLORE_SEARCH,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
} from "../../lib/explore/exploreFilters";
import type {
  ExploreFilterState,
  ExploreSearchParams,
  ExploreSentimentSets,
} from "../../lib/explore/exploreFilters";
import { useExploreOfferings } from "./exploreOfferingsContext";

/**
 * Shared filter context for the Explore detail pages (course / professor). Reads the
 * active filters from the URL (the `/explore` route validates them, so they are
 * available on the nested detail routes), resolves the sentiment + requirement
 * lookups those filters need, and exposes:
 *  - `filters`: the parsed filter state.
 *  - `sentiment` / `requirementCandidateSet`: dependencies for the detail filters.
 *  - `linkSearch`: the serialized filters to thread through internal links so the
 *    active filters persist as the student navigates deeper.
 */
export function useExploreDetailFilters() {
  const searchParams = useSearch({ from: "/explore" });
  const filters = useMemo<ExploreFilterState>(
    () => parseExploreFiltersSearch(searchParams ?? {}),
    [searchParams],
  );

  const { getProfessorEntries } = useExploreOfferings();
  const { remainingRequirements } = useRequirementState();
  const { completedCourses } = useCompletedCourses();

  const feedbackActive = filters.minFeedback !== null;
  const { data: feedbackIndex } = useFeedbackData(feedbackActive);

  const sentiment = useMemo<ExploreSentimentSets | undefined>(() => {
    if (!feedbackActive) return;
    if (!feedbackIndex) return { courseByNorm: null, professorByGroupId: null };
    const byName = professorSentimentByName(feedbackIndex);
    const professorByGroupId = new Map<string, number>();
    for (const e of getProfessorEntries()) {
      const s = byName.get(normalizeProfessorName(e.displayName));
      if (s != null) professorByGroupId.set(e.groupId, s);
    }
    return { courseByNorm: courseSentimentByNorm(feedbackIndex), professorByGroupId };
  }, [feedbackActive, feedbackIndex, getProfessorEntries]);

  const requirementCandidateSet = useMemo<Set<string> | null>(() => {
    if (!filters.contributesToRequirements) return null;
    return buildRequirementCandidateSet(remainingRequirements, completedCourses);
  }, [filters.contributesToRequirements, remainingRequirements, completedCourses]);

  const linkSearch = useMemo<ExploreSearchParams>(
    () => ({ ...EMPTY_EXPLORE_SEARCH, ...serializeExploreFiltersSearch(filters) }),
    [filters],
  );

  return { filters, sentiment, requirementCandidateSet, linkSearch };
}
