/**
 * Filtering for the Explore *detail* pages (single course → its professors, single
 * professor → their courses). The Explore index filters flat search-index rows
 * (`filterCourseEntries` / `filterProfessorEntries`); here we instead narrow the
 * already-grouped offering lists those pages render, while keeping each group's
 * summary grade histogram aggregated over **all** terms (not just the filtered one).
 *
 * Term is the only filter that removes offerings *within* a group (a professor may
 * teach the course in several terms); every other filter removes whole groups. So
 * the all-terms aggregate only diverges from the visible rows when a term filter is
 * active — callers pass the aggregate offerings through to the summary bar in that
 * case so the histogram still reflects the professor's / course's full record.
 */
import { normalizeCourseCode } from "@uoplan/core";
import type { ProfessorRegistry } from "@uoplan/core";
import { groupOfferingsByCourse, groupOfferingsByProfessor } from "./gradesSearch";
import type {
  CourseOfferingGroup,
  ExploreCourseSearchEntry,
  ExploreOfferingFlat,
  ExploreProfessorSearchEntry,
  ProfessorOfferingGroup,
} from "./gradesSearch";
import { filterCourseEntries, filterProfessorEntries } from "./exploreFilters";
import type { ExploreFilterState, ExploreSentimentSets } from "./exploreFilters";

/** All-terms offerings per group id, used to keep summary histograms full while rows are filtered. */
function aggregateOfferingsByProfessorGroup(
  courseOfferings: ExploreOfferingFlat[],
  registry: ProfessorRegistry | null | undefined,
): Map<string, ExploreOfferingFlat[]> {
  const byGroupId = new Map<string, ExploreOfferingFlat[]>();
  for (const g of groupOfferingsByProfessor(courseOfferings, registry)) {
    byGroupId.set(g.groupId, g.offerings);
  }
  return byGroupId;
}

function aggregateOfferingsByCourseGroup(
  professorOfferings: ExploreOfferingFlat[],
): Map<string, ExploreOfferingFlat[]> {
  const byGroupId = new Map<string, ExploreOfferingFlat[]>();
  for (const g of groupOfferingsByCourse(professorOfferings)) byGroupId.set(g.groupId, g.offerings);
  return byGroupId;
}

export type CourseProfessorFilterDeps = {
  /** Global professor search entries keyed by group id (rating + sentiment lookups). */
  profEntryByGroupId: Map<string, ExploreProfessorSearchEntry>;
  sentiment?: ExploreSentimentSets;
  /**
   * Professor registry used to group offerings. Threading it through keeps a
   * predicted ("expected") instructor under the same canonical group id whether or
   * not a term filter strips out the confirmed offering that would otherwise anchor
   * the group — so expected-only professors stay visible (and keep their all-terms
   * grade aggregate + rating lookups) when filtering by term.
   */
  registry?: ProfessorRegistry | null;
};

export type FilteredProfessorGroups = {
  groups: ProfessorOfferingGroup[];
  /** All-terms offerings per group id, or `null` when no term filter narrows the rows. */
  aggregateByGroupId: Map<string, ExploreOfferingFlat[]> | null;
};

/**
 * Course-page professor list: filter a single course's offerings by the active
 * filters. The term filter narrows the offerings (dropping professors with none in
 * the term and trimming each remaining professor's rows); rating / feedback drop
 * whole professor groups via the same predicate the index uses. Course-level filters
 * (level / language / discipline / difficulty / requirements) describe the course
 * itself and are gated by the caller, not here.
 */
export function filterCourseProfessorGroups(
  courseOfferings: ExploreOfferingFlat[],
  filters: ExploreFilterState,
  deps: CourseProfessorFilterDeps,
): FilteredProfessorGroups {
  const byTerm = filters.termId !== null;
  const base = byTerm
    ? courseOfferings.filter((o) => o.termId === filters.termId)
    : courseOfferings;
  let groups = groupOfferingsByProfessor(base, deps.registry);

  const byFeedback = filters.minFeedback !== null && deps.sentiment?.professorByGroupId != null;
  if (filters.minRating !== null || byFeedback) {
    // Reuse the index professor predicate (rating + feedback only; term is handled
    // structurally above and discipline is uniform across one course's professors).
    const profFilters: ExploreFilterState = { ...filters, disciplines: [], termId: null };
    groups = groups.filter((g) => {
      const entry = deps.profEntryByGroupId.get(g.groupId);
      if (!entry) return false;
      return filterProfessorEntries([entry], profFilters, undefined, deps.sentiment).length > 0;
    });
  }

  return {
    groups,
    aggregateByGroupId: byTerm
      ? aggregateOfferingsByProfessorGroup(courseOfferings, deps.registry)
      : null,
  };
}

export type ProfessorCourseFilterDeps = {
  /** Global course search entries keyed by normalized code (level / language / sentiment / …). */
  courseEntryByNorm: Map<string, ExploreCourseSearchEntry>;
  sentiment?: ExploreSentimentSets;
  requirementCandidateSet?: Set<string> | null;
};

export type FilteredCourseGroups = {
  groups: CourseOfferingGroup[];
  aggregateByGroupId: Map<string, ExploreOfferingFlat[]> | null;
};

/**
 * Professor-page course list: filter a single professor's offerings by the active
 * filters. The term filter narrows the offerings (dropping courses with none in the
 * term and trimming each course's rows); the course-level filters (level / language /
 * discipline / difficulty / course-feedback / requirements) drop whole course groups
 * via the index course predicate. The professor-level rating filter is gated by the
 * caller (it describes the single professor, not individual courses).
 */
export function filterProfessorCourseGroups(
  professorOfferings: ExploreOfferingFlat[],
  filters: ExploreFilterState,
  deps: ProfessorCourseFilterDeps,
): FilteredCourseGroups {
  const byTerm = filters.termId !== null;
  const base = byTerm
    ? professorOfferings.filter((o) => o.termId === filters.termId)
    : professorOfferings;
  let groups = groupOfferingsByCourse(base);

  const byFeedback = filters.minFeedback !== null && deps.sentiment?.courseByNorm != null;
  const needsCourseFilter =
    filters.levels.length > 0 ||
    filters.languages.length > 0 ||
    filters.disciplines.length > 0 ||
    filters.difficulty !== null ||
    byFeedback ||
    (filters.contributesToRequirements && deps.requirementCandidateSet != null);
  if (needsCourseFilter) {
    // Drop the professor-level rating filter and the structurally-applied term filter.
    const courseFilters: ExploreFilterState = { ...filters, minRating: null, termId: null };
    groups = groups.filter((g) => {
      const entry = deps.courseEntryByNorm.get(normalizeCourseCode(g.courseCode));
      if (!entry) return true;
      return (
        filterCourseEntries(
          [entry],
          courseFilters,
          undefined,
          deps.sentiment,
          deps.requirementCandidateSet,
        ).length > 0
      );
    });
  }

  return {
    groups,
    aggregateByGroupId: byTerm ? aggregateOfferingsByCourseGroup(professorOfferings) : null,
  };
}

/**
 * Whether the course itself passes the course-level filters (level / language /
 * discipline / difficulty / requirements). Rating, feedback and term are excluded —
 * those narrow the professor list, not the course as a whole.
 */
export function courseMatchesCourseLevelFilters(
  entry: ExploreCourseSearchEntry | undefined,
  filters: ExploreFilterState,
  requirementCandidateSet?: Set<string> | null,
): boolean {
  if (!entry) return true;
  const gate: ExploreFilterState = {
    ...filters,
    minRating: null,
    minFeedback: null,
    termId: null,
  };
  return (
    filterCourseEntries([entry], gate, undefined, undefined, requirementCandidateSet).length > 0
  );
}

/** Whether the professor's own rating clears the active min-rating filter (prof-page gate). */
export function professorMatchesRatingFilter(
  maxRating: number | null,
  minRating: number | null,
): boolean {
  if (minRating === null) return true;
  return maxRating !== null && maxRating >= minRating;
}
