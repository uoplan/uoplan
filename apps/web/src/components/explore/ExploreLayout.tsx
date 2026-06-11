import { useRouterState } from "@tanstack/react-router";
import { Box } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { AnimatePresence, m } from "framer-motion";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTr } from "../../i18n";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { formatTermLabel } from "../../lib/term/termLabel";
import { useAppStore } from "../../store/appStore";
import { ExploreLayoutHeader } from "./ExploreLayoutHeader";
import { ExploreSearchResults } from "./ExploreSearchResults";
import { useExploreResults } from "./useExploreResults";
import { useExploreSearch } from "./useExploreSearch";

type ExploreLayoutProps = {
  children: ReactNode;
};

const EXPLORE_INDEX_ROUTE_ID = "/explore/";

export function ExploreLayout({ children }: ExploreLayoutProps) {
  useTr();
  const { i18n } = useLingui();
  const leafRouteId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId as string | undefined,
  });
  const onIndex = leafRouteId === EXPLORE_INDEX_ROUTE_ID;
  const showBackButton = !onIndex;

  const { catalogue, professorRatings, disciplines, terms } = useAppStore(
    useShallow((s) => ({
      catalogue: s.catalogue,
      professorRatings: s.professorRatings,
      disciplines: s.disciplines,
      terms: s.terms,
    })),
  );

  const disciplineOptions = useMemo(() => {
    if (!disciplines) return [];
    const isFr = i18n.locale.startsWith("fr");
    return disciplines
      .map((d) => ({ code: d.code, name: isFr ? (d.nameFr ?? d.name) : d.name }))
      .sort((a, b) => a.code.localeCompare(b.code, "en"));
  }, [disciplines, i18n.locale]);

  const termOptions = useMemo(() => {
    if (!terms) return [];
    void i18n.locale;
    return terms
      .map((t) => ({ value: String(t.termId), label: formatTermLabel(Number(t.termId)) }))
      .sort((a, b) => Number(b.value) - Number(a.value));
  }, [terms, i18n.locale]);

  const {
    query,
    debouncedQuery,
    filters,
    activeFilters,
    searchEngaged,
    setSearchEngaged,
    currentSearchParams,
    handleQueryChange,
    handleFilterChange,
  } = useExploreSearch(onIndex);

  const {
    loading,
    displayedCourses,
    displayedProfessors,
    disciplineResults,
    programResults,
    disciplineCourseCount,
    hasResults,
    professorsFirst,
  } = useExploreResults({ query, debouncedQuery, filters, activeFilters, catalogue, disciplines });

  const showResults = searchEngaged && (debouncedQuery.trim().length > 0 || activeFilters);
  const renderResults = onIndex && showResults;

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
      <ExploreLayoutHeader
        onIndex={onIndex}
        showBackButton={showBackButton}
        query={query}
        onQueryChange={handleQueryChange}
        onSearchFocus={() => setSearchEngaged(true)}
        loading={loading}
        filters={filters}
        onFilterChange={handleFilterChange}
        disciplineOptions={disciplineOptions}
        termOptions={termOptions}
      />

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
            <ExploreSearchResults
              hasResults={hasResults}
              activeFilters={activeFilters}
              query={query}
              debouncedQuery={debouncedQuery}
              onClearFilters={() => handleFilterChange(EMPTY_FILTERS)}
              professorsFirst={professorsFirst}
              displayedCourses={displayedCourses}
              displayedProfessors={displayedProfessors}
              disciplineResults={disciplineResults}
              programResults={programResults}
              disciplineCourseCount={disciplineCourseCount}
              professorRatings={professorRatings}
              currentSearchParams={currentSearchParams}
            />
          ) : (
            <m.div
              key="page-content"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
              {children}
            </m.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
