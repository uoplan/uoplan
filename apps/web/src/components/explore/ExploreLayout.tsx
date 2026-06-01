import { Link, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { Anchor, Box, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Catalogue } from "@uoplan/core";

import { useTr, tr } from "../../i18n";
import {
  searchExplore,
  dedupeCourseEntriesByComponent,
  type ExploreCourseSearchEntry,
  type ExploreProfessorSearchEntry,
} from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import {
  EMPTY_FILTERS,
  compareCourseEntries,
  compareProfessorEntries,
  filterCourseEntries,
  filterProfessorEntries,
  hasActiveFilters,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
  type ExploreSearchParams,
  type ExploreFilterState,
} from "../../lib/explore/exploreFilters";
import {
  buildProgramSearchEntries,
  createExploreProgramFuse,
  searchExplorePrograms,
} from "../../lib/explore/programSearch";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { BackButton } from "../shared/BackButton";
import { ExploreFilterBar } from "./ExploreFilterBar";
import { EXPLORE_ACCORDION_PAD_INLINE } from "./ExploreProfessorGradesLayout";
import { SearchResultCourseCard } from "./SearchResultCourseCard";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";
import { SearchResultProfessorCard } from "./SearchResultProfessorCard";
import { SearchResultProgramCard } from "./SearchResultProgramCard";

const EMPTY_COURSE_ENTRIES: ExploreCourseSearchEntry[] = [];
const EMPTY_PROFESSOR_ENTRIES: ExploreProfessorSearchEntry[] = [];

function ExploreSearchInput({
  value,
  onChange,
  onFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  disabled: boolean;
}) {
  return (
    <TextInput
      placeholder={tr("explore.searchPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onFocus={onFocus}
      size="lg"
      radius={9999}
      disabled={disabled}
      w="100%"
      autoComplete="off"
      aria-label={tr("explore.searchPlaceholder")}
      styles={{
        root: { width: "100%" },
        input: {
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border-strong)",
          minHeight: 48,
          paddingInline: 18,
          fontSize: "var(--mantine-font-size-md)",
          boxShadow: "var(--app-shadow-sm)",
          "@media (min-width: 540px)": { minHeight: 52, paddingInline: 22 },
        },
      }}
    />
  );
}

function SearchCardSection({
  label,
  delay = 0,
  children,
}: {
  label: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1], delay }}
    >
      <Stack gap={10}>
        <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
          <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: "0.02em" }}>
            {label}
          </Text>
        </Box>
        <Box
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: 10,
            scrollbarWidth: "thin",
            scrollbarColor: "var(--app-border-strong) transparent",
          }}
        >
          <Box style={{ display: "flex", gap: 10, width: "max-content" }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {children}
            </AnimatePresence>
          </Box>
        </Box>
      </Stack>
    </motion.div>
  );
}

const DISCIPLINE_MAX_RESULTS = 8;

function buildDisciplineCourseCount(catalogue: Catalogue | null): Map<string, number> {
  const m = new Map<string, number>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) {
    const disc = c.code.split(/\s+/)[0]?.toUpperCase();
    if (disc) m.set(disc, (m.get(disc) ?? 0) + 1);
  }
  return m;
}

type ExploreLayoutProps = {
  children: ReactNode;
};

const EXPLORE_INDEX_ROUTE_ID = "/explore/";

export function ExploreLayout({ children }: ExploreLayoutProps) {
  useTr();
  const { loading, getCourseEntries, getProfessorEntries, getCourseFuse } = useExploreOfferings();
  const navigate = useNavigate();
  const { catalogue, professorRatings, disciplines } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      professorRatings: s.professorRatings,
      disciplines: s.disciplines,
    })),
  );

  const searchParams = useSearch({ from: "/explore" });

  const leafRouteId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId as string | undefined,
  });
  const onIndex = leafRouteId === EXPLORE_INDEX_ROUTE_ID;
  const showBackButton = !onIndex;

  const parsedFilters = useMemo(
    () => parseExploreFiltersSearch(searchParams ?? {}),
    [searchParams],
  );
  const [query, setQueryState] = useState(searchParams.q ?? "");
  const [debouncedQuery] = useDebouncedValue(query, 120);
  const [filters, setFilters] = useState<ExploreFilterState>(parsedFilters);
  const [searchEngaged, setSearchEngaged] = useState(onIndex);

  useEffect(() => {
    setQueryState(searchParams.q ?? "");
  }, [searchParams.q]);

  useEffect(() => {
    setFilters(parsedFilters);
  }, [parsedFilters]);

  const buildSearchParams = (
    nextFilters: ExploreFilterState,
    nextQuery: string,
  ): ExploreSearchParams => {
    const params = serializeExploreFiltersSearch(nextFilters);
    const trimmed = nextQuery.trim();
    return {
      q: trimmed.length > 0 ? trimmed : undefined,
      levels: params.levels ?? undefined,
      langs: params.langs ?? undefined,
      difficulty: params.difficulty ?? undefined,
      minRating: params.minRating ?? undefined,
      sort: params.sort ?? undefined,
      dir: params.dir ?? undefined,
    };
  };

  // Search/filter edits always land on the index route's results view. When
  // already on the index we replace history so keystrokes don't pile up; from a
  // detail page we push so the in-app/browser back returns to the detail page.
  const handleQueryChange = (v: string) => {
    setQueryState(v);
    setSearchEngaged(true);
    void navigate({
      to: "/explore",
      search: buildSearchParams(filters, v) as any,
      replace: onIndex,
    });
  };

  const handleFilterChange = (next: Partial<ExploreFilterState>) => {
    setSearchEngaged(true);
    setFilters((prev) => {
      const updated = { ...prev, ...next };
      void navigate({
        to: "/explore",
        search: buildSearchParams(updated, query) as any,
        replace: onIndex,
      });
      return updated;
    });
  };

  const activeFilters = hasActiveFilters(filters) || filters.sortKey !== "relevance";

  // The corpus-wide search indices are only needed once the user engages search
  // (a query or any active filter). Latch the moment they're first needed and keep
  // it true so clearing the query doesn't discard/rebuild the cached indices.
  const needsSearchIndex = debouncedQuery.trim().length > 0 || activeFilters;
  const [indexNeeded, setIndexNeeded] = useState(
    () =>
      (searchParams.q?.trim().length ?? 0) > 0 ||
      hasActiveFilters(parsedFilters) ||
      parsedFilters.sortKey !== "relevance",
  );
  useEffect(() => {
    if (needsSearchIndex) setIndexNeeded(true);
  }, [needsSearchIndex]);

  const courseEntries = indexNeeded ? getCourseEntries() : EMPTY_COURSE_ENTRIES;
  const professorEntries = indexNeeded ? getProfessorEntries() : EMPTY_PROFESSOR_ENTRIES;
  const courseFuse = indexNeeded ? getCourseFuse() : null;

  const rawSearchResults = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q || !courseFuse) return null;
    return searchExplore(q, { courseFuse, courseEntries, professorEntries });
  }, [debouncedQuery, courseFuse, courseEntries, professorEntries]);

  const searchResults = useMemo(() => {
    if (!rawSearchResults) return null;
    if (!activeFilters) return rawSearchResults;
    const filteredCourses = filterCourseEntries(rawSearchResults.courses, filters);
    const filteredProfessors = filterProfessorEntries(rawSearchResults.professors, filters);
    const shouldSortCourses = filters.sortKey === "avgGrade" || filters.sortKey === "courseCode";
    const shouldSortProfessors = filters.sortKey === "profRating";
    return {
      ...rawSearchResults,
      courses: shouldSortCourses
        ? filteredCourses
            .slice()
            .sort((a, b) => compareCourseEntries(a, b, filters.sortKey, filters.sortDir))
        : filteredCourses,
      professors: shouldSortProfessors
        ? filteredProfessors
            .slice()
            .sort((a, b) => compareProfessorEntries(a, b, filters.sortKey, filters.sortDir))
        : filteredProfessors,
    };
  }, [rawSearchResults, activeFilters, filters]);

  const filterOnlyCourses = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q || !activeFilters) return null;
    const filtered = dedupeCourseEntriesByComponent(filterCourseEntries(courseEntries, filters));
    if (filters.sortKey === "relevance") return filtered.slice(0, 24);
    if (filters.sortKey === "profRating") return filtered.slice(0, 24);
    return filtered
      .slice()
      .sort((a, b) => compareCourseEntries(a, b, filters.sortKey, filters.sortDir))
      .slice(0, 24);
  }, [debouncedQuery, activeFilters, courseEntries, filters]);

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

  const showResults = searchEngaged && (debouncedQuery.trim().length > 0 || activeFilters);
  const renderResults = onIndex && showResults;
  const hasResults =
    (searchResults?.courses.length ?? 0) > 0 ||
    (filterOnlyCourses?.length ?? 0) > 0 ||
    (searchResults?.professors.length ?? 0) > 0 ||
    disciplineResults.length > 0 ||
    programResults.length > 0;

  const displayedCourses = filterOnlyCourses ?? searchResults?.courses ?? [];

  const currentSearchParams = useMemo(() => buildSearchParams(filters, query), [filters, query]);

  const coursesSection =
    displayedCourses.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsCourses")} delay={0}>
        {displayedCourses.map((entry) => (
          <motion.div
            key={entry.normCode}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultCourseCard
              entry={entry}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          </motion.div>
        ))}
      </SearchCardSection>
    ) : null;

  const disciplinesSection =
    disciplineResults.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsDisciplines")} delay={0.04}>
        {disciplineResults.map((d) => (
          <motion.div
            key={d.code}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultDisciplineCard
              discipline={d}
              courseCount={disciplineCourseCount.get(d.code) ?? 0}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          </motion.div>
        ))}
      </SearchCardSection>
    ) : null;

  const professorsSection =
    searchResults && searchResults.professors.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsProfessors")} delay={0.06}>
        {searchResults.professors.map((entry) => (
          <motion.div
            key={entry.groupId}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultProfessorCard
              entry={entry}
              professorRatings={professorRatings}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          </motion.div>
        ))}
      </SearchCardSection>
    ) : null;

  const programsSection =
    programResults.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsPrograms")} delay={0.08}>
        {programResults.map((program) => (
          <motion.div
            key={program.slug}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultProgramCard program={program} query={debouncedQuery} />
          </motion.div>
        ))}
      </SearchCardSection>
    ) : null;

  const orderedSections = searchResults?.professorsFirst
    ? [professorsSection, coursesSection, disciplinesSection, programsSection]
    : [coursesSection, disciplinesSection, programsSection, professorsSection];

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--app-bg)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Header */}
      <Box
        pt={24}
        pb="md"
        style={{
          flexShrink: 0,
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
        }}
      >
        <Box mb={8}>
          <BackButton
            fallbackTo={onIndex ? "/" : "/explore"}
            fallbackLabel={onIndex ? tr("app.nav.backHome") : tr("explore.title")}
          />
        </Box>
        <Stack gap="md" maw={520}>
          <Title
            order={showBackButton ? 3 : 2}
            c="var(--app-text)"
            fw={600}
            fz={showBackButton ? { base: "h4", sm: "h3" } : { base: "h3", sm: "h2" }}
          >
            {showBackButton ? (
              <Anchor
                component={Link}
                to="/explore"
                c="inherit"
                underline="hover"
                fz="inherit"
                fw="inherit"
              >
                {tr("explore.title")}
              </Anchor>
            ) : (
              tr("explore.title")
            )}
          </Title>
          <ExploreSearchInput
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setSearchEngaged(true)}
            disabled={loading}
          />
        </Stack>
        <Box mt="md">
          <ExploreFilterBar filters={filters} onChange={handleFilterChange} />
        </Box>
      </Box>

      {/* Content area */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          paddingBottom: renderResults ? 48 : 0,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {renderResults ? (
            <motion.div
              key="search-results"
              initial={{ y: 14 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ flex: 1 }}
            >
              {hasResults ? (
                <Stack gap={28} mt={8}>
                  {orderedSections}
                </Stack>
              ) : (
                <Box
                  style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingRight: 24 }}
                  mt={8}
                >
                  <Text size="sm" c="dimmed">
                    {activeFilters && !debouncedQuery.trim()
                      ? tr("explore.filter.noResults")
                      : tr("search.noResults", { q: query.trim() })}
                  </Text>
                  {activeFilters && (
                    <Text
                      size="sm"
                      c="var(--app-accent)"
                      mt={4}
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                      onClick={() => handleFilterChange(EMPTY_FILTERS)}
                    >
                      {tr("explore.filter.clearFilters")}
                    </Text>
                  )}
                </Box>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="page-content"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
