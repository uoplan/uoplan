/**
 * Filtering for the Explore *detail* pages (single course → its professors, single
 * professor → their courses). The Explore index filters flat search-index rows
 * (`filterCourseEntries` / `filterProfessorEntries`); here we instead narrow the
 * already-grouped offering lists those pages render.
 *
 * The term filter only decides *which groups* are shown — a professor (or course)
 * stays in the list when they have at least one offering in the active term. Once a
 * group survives that selection it keeps **all** of its offerings across **every**
 * term, since a prof's earlier terms / a course's earlier sections are useful
 * context. Every other filter (rating / feedback / level / language / discipline /
 * difficulty / requirements) removes whole groups too, never individual offerings —
 * so the rendered rows always equal the group's full record, and the summary grade
 * histogram is built straight from `group.offerings`.
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

/**
 * Keep only the groups that have at least one offering in the active term. The term
 * slice is re-grouped with the same grouper so expected/predicted membership (which a
 * raw `termId` scan would miss) is honoured; the surviving groups themselves are left
 * untouched, so each keeps all of its offerings across every term.
 */
function selectGroupsPresentInTerm<G extends { groupId: string }>(
  groups: G[],
  offerings: ExploreOfferingFlat[],
  termId: number,
  group: (items: ExploreOfferingFlat[]) => G[],
): G[] {
  const termGroupIds = new Set(
    group(offerings.filter((o) => o.termId === termId)).map((g) => g.groupId),
  );
  return groups.filter((g) => termGroupIds.has(g.groupId));
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
};

/**
 * Course-page professor list: filter a single course's offerings by the active
 * filters. The term filter only *selects* which professors appear (those teaching the
 * course in the active term); each surviving professor keeps all of their offerings
 * across every term. Rating / feedback drop whole professor groups via the same
 * predicate the index uses. Course-level filters (level / language / discipline /
 * difficulty / requirements) describe the course itself and are gated by the caller,
 * not here.
 */
export function filterCourseProfessorGroups(
  courseOfferings: ExploreOfferingFlat[],
  filters: ExploreFilterState,
  deps: CourseProfessorFilterDeps,
): FilteredProfessorGroups {
  // Group every term so each surviving professor keeps their full record.
  let groups = groupOfferingsByProfessor(courseOfferings, deps.registry);

  if (filters.termId !== null) {
    // Selection: keep only professors present in the active term. Grouping the term
    // slice with the same registry preserves expected/predicted membership, so a
    // predicted-but-unconfirmed instructor for the term stays visible (and keeps the
    // confirmed past terms surfaced by the all-terms grouping above).
    groups = selectGroupsPresentInTerm(groups, courseOfferings, filters.termId, (items) =>
      groupOfferingsByProfessor(items, deps.registry),
    );
  }

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

  return { groups };
}

export type ProfessorCourseFilterDeps = {
  /** Global course search entries keyed by normalized code (level / language / sentiment / …). */
  courseEntryByNorm: Map<string, ExploreCourseSearchEntry>;
  sentiment?: ExploreSentimentSets;
  requirementCandidateSet?: Set<string> | null;
};

export type FilteredCourseGroups = {
  groups: CourseOfferingGroup[];
};

/**
 * Professor-page course list: filter a single professor's offerings by the active
 * filters. The term filter only *selects* which courses appear (those the professor
 * taught in the active term); each surviving course keeps all of its offerings across
 * every term. The course-level filters (level / language / discipline / difficulty /
 * course-feedback / requirements) drop whole course groups via the index course
 * predicate. The professor-level rating filter is gated by the caller (it describes
 * the single professor, not individual courses).
 */
export function filterProfessorCourseGroups(
  professorOfferings: ExploreOfferingFlat[],
  filters: ExploreFilterState,
  deps: ProfessorCourseFilterDeps,
): FilteredCourseGroups {
  // Group every term so each surviving course keeps its full record.
  let groups = groupOfferingsByCourse(professorOfferings);

  if (filters.termId !== null) {
    // Selection: keep only courses the professor taught in the active term.
    groups = selectGroupsPresentInTerm(
      groups,
      professorOfferings,
      filters.termId,
      groupOfferingsByCourse,
    );
  }

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

  return { groups };
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
