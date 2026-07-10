import { useRouterState } from "@tanstack/react-router";
import { Affix, Box, Group } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { AnimatePresence, m } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { formatTermLabel } from "../../lib/term/termLabel";
import {
  useCatalogue,
  useCompletedCourses,
  useDisciplines,
  useFaculties,
  useProfessorRatings,
  useRequirementState,
  useTerms,
} from "@uoplan/store/hooks";
import { AddToBasketButton } from "../basket/AddToBasketButton";
import { BasketFab } from "../basket/BasketFab";
import { AddToCompareButton } from "./compare/AddToCompareButton";
import { CompareTray } from "./compare/CompareTray";
import {
  ExploreBasketTargetContext,
  useExploreBasketTargetCode,
} from "./exploreBasketTargetContext";
import { ExploreLayoutHeader } from "./ExploreLayoutHeader";
import { ExploreSearchResults } from "./ExploreSearchResults";
import { useExploreResults } from "./useExploreResults";
import { useExploreSearch } from "./useExploreSearch";

type ExploreLayoutProps = {
  children: ReactNode;
};

const EXPLORE_INDEX_ROUTE_ID = "/explore/";

/**
 * Top-right (desktop) / floating bottom-right (mobile) cluster holding the cart and,
 * when a course page is mounted, the floating "add to basket" pill to its left.
 */
function ExploreCartCluster() {
  const code = useExploreBasketTargetCode();
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });
  const pill = code ? <AddToBasketButton code={code} variant="pill" /> : null;
  const compare = code ? <AddToCompareButton code={code} variant="icon" size="lg" /> : null;

  if (isMobile) {
    return (
      <Affix position={{ bottom: 24, right: 24 }} zIndex={150}>
        <Group gap={10} align="center" wrap="nowrap">
          {compare}
          {pill}
          <BasketFab inline />
        </Group>
      </Affix>
    );
  }

  return (
    <Box
      style={{
        position: "absolute",
        top: 8,
        right: 0,
        paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
        zIndex: 5,
      }}
    >
      <Group gap={8} align="center" wrap="nowrap">
        {compare}
        {pill}
        <BasketFab inline />
      </Group>
    </Box>
  );
}

export function ExploreLayout({ children }: ExploreLayoutProps) {
  useTr();
  const analytics = useAnalytics();
  const { i18n } = useLingui();
  const lastSearchSignature = useRef<string | null>(null);
  const leafRouteId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId as string | undefined,
  });
  const onIndex = leafRouteId === EXPLORE_INDEX_ROUTE_ID;
  const showBackButton = !onIndex;

  // Course pages publish their code here so the cart cluster can show a floating
  // "add to basket" pill next to the cart.
  const [basketTargetCode, setBasketTargetCode] = useState<string | null>(null);
  const basketTargetValue = useMemo(
    () => ({ code: basketTargetCode, setCode: setBasketTargetCode }),
    [basketTargetCode],
  );

  const catalogue = useCatalogue();
  const professorRatings = useProfessorRatings();
  const disciplines = useDisciplines();
  const faculties = useFaculties();
  const terms = useTerms();
  const { remainingRequirements } = useRequirementState();
  const { completedCourses } = useCompletedCourses();

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
    deliveryLoading,
    deliveryError,
    schedulesError,
    retrySchedules,
    displayedCourses,
    displayedProfessors,
    disciplineResults,
    facultyResults,
    programResults,
    disciplineCourseCount,
    hasResults,
    professorsFirst,
    virtualCourseComponents,
  } = useExploreResults({
    query,
    debouncedQuery,
    filters,
    activeFilters,
    catalogue,
    disciplines,
    faculties,
    remainingRequirements,
    completedCourses,
  });

  const showResults = searchEngaged && (debouncedQuery.trim().length > 0 || activeFilters);
  const renderResults = onIndex && showResults;
  const exploreResultCount =
    displayedCourses.length +
    displayedProfessors.length +
    disciplineResults.length +
    facultyResults.length +
    programResults.length;

  useEffect(() => {
    if (!renderResults || loading || deliveryLoading || deliveryError) return;
    const hasQuery = debouncedQuery.trim().length > 0;
    const signature = JSON.stringify({
      hasQuery,
      count: exploreResultCount,
      search: currentSearchParams,
    });
    if (lastSearchSignature.current === signature) return;
    lastSearchSignature.current = signature;
    analytics.capture("explore_search", {
      hasQuery,
      resultCount: exploreResultCount,
    });
  }, [
    analytics,
    currentSearchParams,
    debouncedQuery,
    deliveryError,
    deliveryLoading,
    exploreResultCount,
    loading,
    renderResults,
  ]);

  return (
    <ExploreBasketTargetContext.Provider value={basketTargetValue}>
      <Box
        component="main"
        style={{
          position: "relative",
          minHeight: "100dvh",
          backgroundColor: "var(--app-bg)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
        }}
      >
        <ExploreCartCluster />
        <CompareTray />

        <ExploreLayoutHeader
          onIndex={onIndex}
          showBackButton={showBackButton}
          query={query}
          onQueryChange={handleQueryChange}
          onSearchFocus={() => setSearchEngaged(true)}
          loading={loading}
          filters={filters}
          onFilterChange={handleFilterChange}
          requirementsAvailable={remainingRequirements.length > 0}
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
                deliveryActive={filters.delivery !== null}
                deliveryLoading={deliveryLoading}
                schedulesError={schedulesError}
                retrySchedules={retrySchedules}
                professorsFirst={professorsFirst}
                displayedCourses={displayedCourses}
                displayedProfessors={displayedProfessors}
                disciplineResults={disciplineResults}
                facultyResults={facultyResults}
                disciplines={disciplines}
                programResults={programResults}
                disciplineCourseCount={disciplineCourseCount}
                professorRatings={professorRatings}
                currentSearchParams={currentSearchParams}
                virtualCourseComponents={virtualCourseComponents}
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
    </ExploreBasketTargetContext.Provider>
  );
}
