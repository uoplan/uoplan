import { useEffect, useMemo, useState } from "react";
import type { Catalogue, Discipline, Faculty, RemainingRequirement } from "@uoplan/core";
import {
  courseSentimentByNorm,
  normalizeProfessorName,
  professorSentimentByName,
} from "@uoplan/core";
import { dedupeCourseEntriesByComponent, searchExplore } from "../../lib/explore/gradesSearch";
import type {
  ExploreCourseSearchEntry,
  ExploreProfessorSearchEntry,
} from "../../lib/explore/gradesSearch";
import {
  buildRequirementCandidateSet,
  compareCourseEntries,
  compareProfessorEntries,
  filterCourseEntries,
  filterProfessorEntries,
} from "../../lib/explore/exploreFilters";
import { deliverySetsForTerm } from "../../lib/explore/deliveryMode";
import type {
  ExploreFilterState,
  ExploreSentimentSets,
  ExploreTermSets,
} from "../../lib/explore/exploreFilters";
import {
  buildProgramSearchEntries,
  createExploreProgramFuse,
  searchExplorePrograms,
} from "../../lib/explore/programSearch";
import { buildDisciplineCourseCount, filterFaculties } from "../../lib/explore/faculty";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import { useDescriptionSearchIndex } from "../../hooks/useDescriptionSearchIndex";
import { useExploreOfferings } from "./exploreOfferingsContext";

const EMPTY_COURSE_ENTRIES: ExploreCourseSearchEntry[] = [];
const EMPTY_PROFESSOR_ENTRIES: ExploreProfessorSearchEntry[] = [];
const DISCIPLINE_MAX_RESULTS = 8;
const FACULTY_MAX_RESULTS = 6;

type UseExploreResultsArgs = {
  query: string;
  debouncedQuery: string;
  filters: ExploreFilterState;
  activeFilters: boolean;
  catalogue: Catalogue | null;
  disciplines: Discipline[] | null;
  faculties: Faculty[] | null;
  remainingRequirements: RemainingRequirement[];
  completedCourses: string[];
};

export function useExploreResults({
  query,
  debouncedQuery,
  filters,
  activeFilters,
  catalogue,
  disciplines,
  faculties,
  remainingRequirements,
  completedCourses,
}: UseExploreResultsArgs) {
  const {
    loading: gradeLoading,
    schedulesLoading,
    schedulesError,
    retrySchedules,
    deliveryPresence,
    getCourseEntries,
    getCourseEntryByNorm,
    getProfessorEntries,
    getTermPresence,
    getCourseFuse,
  } = useExploreOfferings();

  const needsSearchIndex = debouncedQuery.trim().length > 0 || activeFilters;
  const [indexNeeded, setIndexNeeded] = useState(() => query.trim().length > 0 || activeFilters);
  useEffect(() => {
    if (needsSearchIndex) setIndexNeeded(true);
  }, [needsSearchIndex]);

  const courseEntries = indexNeeded ? getCourseEntries() : EMPTY_COURSE_ENTRIES;
  const professorEntries = indexNeeded ? getProfessorEntries() : EMPTY_PROFESSOR_ENTRIES;
  const courseFuse = indexNeeded ? getCourseFuse() : null;

  // Description keyword search is a text-query-only augmentation (not used in the
  // filter-only browse mode), lazily fetched on first query.
  const descriptionSearchEnabled = debouncedQuery.trim().length > 0;
  const { index: descriptionIndex } = useDescriptionSearchIndex(descriptionSearchEnabled);

  const rawSearchResults = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q || !courseFuse) return null;
    return searchExplore(q, {
      courseFuse,
      courseEntries,
      professorEntries,
      descriptionIndex,
      courseEntryByNorm: indexNeeded ? getCourseEntryByNorm() : null,
    });
  }, [
    debouncedQuery,
    courseFuse,
    courseEntries,
    professorEntries,
    descriptionIndex,
    indexNeeded,
    getCourseEntryByNorm,
  ]);

  const termSets = useMemo<ExploreTermSets | undefined>(() => {
    if (filters.termId === null) return;
    const presence = getTermPresence();
    return {
      courseComponents: presence.courseComponentsByTerm.get(filters.termId) ?? null,
      profGroups: presence.profGroupsByTerm.get(filters.termId) ?? null,
    };
  }, [filters.termId, getTermPresence]);
  const deliverySets = useMemo(
    () => deliverySetsForTerm(deliveryPresence, filters.termId),
    [deliveryPresence, filters.termId],
  );
  const virtualCourseComponents = deliverySets.virtual;
  const deliveryActive = filters.delivery !== null;
  const deliveryLoading = deliveryActive && schedulesLoading;
  const deliveryError = deliveryActive ? schedulesError : null;

  const feedbackActive = filters.minFeedback !== null || filters.sortKey === "feedback";
  const { data: feedbackIndex } = useFeedbackData(feedbackActive);
  const sentimentSets = useMemo<ExploreSentimentSets | undefined>(() => {
    if (!feedbackActive) return;
    if (!feedbackIndex) return { courseByNorm: null, professorByGroupId: null };
    const byName = professorSentimentByName(feedbackIndex);
    const professorByGroupId = new Map<string, number>();
    for (const e of professorEntries) {
      const sentiment = byName.get(normalizeProfessorName(e.displayName));
      if (sentiment != null) professorByGroupId.set(e.groupId, sentiment);
    }
    return { courseByNorm: courseSentimentByNorm(feedbackIndex), professorByGroupId };
  }, [feedbackActive, feedbackIndex, professorEntries]);

  const requirementCandidateSet = useMemo<Set<string> | null>(() => {
    if (!filters.contributesToRequirements) return null;
    return buildRequirementCandidateSet(remainingRequirements, completedCourses);
  }, [filters.contributesToRequirements, remainingRequirements, completedCourses]);

  const searchResults = useMemo(() => {
    if (!rawSearchResults) return null;
    if (!activeFilters) return rawSearchResults;
    const filteredCourses = filterCourseEntries(
      rawSearchResults.courses,
      filters,
      termSets,
      sentimentSets,
      requirementCandidateSet,
      deliverySets,
    );
    const filteredProfessors = filterProfessorEntries(
      rawSearchResults.professors,
      filters,
      termSets,
      sentimentSets,
    );
    const shouldSortCourses =
      filters.sortKey === "grade" || filters.sortKey === "code" || filters.sortKey === "feedback";
    const shouldSortProfessors = filters.sortKey === "rating" || filters.sortKey === "feedback";
    return {
      ...rawSearchResults,
      courses: shouldSortCourses
        ? filteredCourses
            .slice()
            .sort((a, b) =>
              compareCourseEntries(
                a,
                b,
                filters.sortKey,
                filters.sortDir,
                sentimentSets?.courseByNorm,
              ),
            )
        : filteredCourses,
      professors: shouldSortProfessors
        ? filteredProfessors
            .slice()
            .sort((a, b) =>
              compareProfessorEntries(
                a,
                b,
                filters.sortKey,
                filters.sortDir,
                sentimentSets?.professorByGroupId,
              ),
            )
        : filteredProfessors,
    };
  }, [
    rawSearchResults,
    activeFilters,
    filters,
    termSets,
    sentimentSets,
    requirementCandidateSet,
    deliverySets,
  ]);

  const isFilterOnlyMode = debouncedQuery.trim().length === 0 && activeFilters;

  const filterOnlyCourses = useMemo(() => {
    if (!isFilterOnlyMode) return null;
    const filtered = dedupeCourseEntriesByComponent(
      filterCourseEntries(
        courseEntries,
        filters,
        termSets,
        sentimentSets,
        requirementCandidateSet,
        deliverySets,
      ),
    );
    if (filters.sortKey === "relevance") return filtered.slice(0, 24);
    if (filters.sortKey === "rating") return filtered.slice(0, 24);
    return filtered
      .slice()
      .sort((a, b) =>
        compareCourseEntries(a, b, filters.sortKey, filters.sortDir, sentimentSets?.courseByNorm),
      )
      .slice(0, 24);
  }, [
    isFilterOnlyMode,
    courseEntries,
    filters,
    termSets,
    sentimentSets,
    requirementCandidateSet,
    deliverySets,
  ]);

  const filterOnlyProfessors = useMemo(() => {
    if (!isFilterOnlyMode) return null;
    const filtered = filterProfessorEntries(professorEntries, filters, termSets, sentimentSets);
    if (filters.sortKey === "rating" || filters.sortKey === "feedback") {
      return filtered
        .slice()
        .sort((a, b) =>
          compareProfessorEntries(
            a,
            b,
            filters.sortKey,
            filters.sortDir,
            sentimentSets?.professorByGroupId,
          ),
        )
        .slice(0, 24);
    }
    return filtered.slice(0, 24);
  }, [isFilterOnlyMode, professorEntries, filters, termSets, sentimentSets]);

  const disciplineCourseCount = useMemo(() => buildDisciplineCourseCount(catalogue), [catalogue]);
  const disciplineResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q || !disciplines) return [];
    return disciplines
      .filter(
        (d) =>
          d.code.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          (d.nameFr?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, DISCIPLINE_MAX_RESULTS);
  }, [debouncedQuery, disciplines]);

  const facultyResults = useMemo(
    () => filterFaculties(faculties, debouncedQuery, FACULTY_MAX_RESULTS),
    [debouncedQuery, faculties],
  );

  const programEntries = useMemo(
    () => (catalogue ? buildProgramSearchEntries(catalogue.programs) : []),
    [catalogue],
  );
  const programFuse = useMemo(
    () => (programEntries.length > 0 ? createExploreProgramFuse(programEntries) : null),
    [programEntries],
  );
  const programResults = useMemo(
    () => searchExplorePrograms(programFuse, programEntries, debouncedQuery),
    [programFuse, programEntries, debouncedQuery],
  );

  const displayedCourses = filterOnlyCourses ?? searchResults?.courses ?? [];
  const displayedProfessors = deliveryActive
    ? []
    : (filterOnlyProfessors ?? searchResults?.professors ?? []);
  const scopedDisciplineResults = deliveryActive ? [] : disciplineResults;
  const scopedFacultyResults = deliveryActive ? [] : facultyResults;
  const scopedProgramResults = deliveryActive ? [] : programResults;
  const hasResults =
    displayedCourses.length > 0 ||
    displayedProfessors.length > 0 ||
    scopedDisciplineResults.length > 0 ||
    scopedFacultyResults.length > 0 ||
    scopedProgramResults.length > 0;

  return {
    loading: gradeLoading,
    deliveryLoading,
    deliveryError,
    schedulesError,
    retrySchedules,
    displayedCourses,
    displayedProfessors,
    disciplineResults: scopedDisciplineResults,
    facultyResults: scopedFacultyResults,
    programResults: scopedProgramResults,
    disciplineCourseCount,
    hasResults,
    professorsFirst: searchResults?.professorsFirst ?? false,
    virtualCourseComponents,
  };
}
