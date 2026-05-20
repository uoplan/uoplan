import { Link, useNavigate } from "@tanstack/react-router";
import { Anchor, Box, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "@uoplan/schedule";
import { normalizeCourseCode } from "@uoplan/schedule";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  createExploreCourseFuse,
  searchExplore,
} from "../../lib/explore/gradesSearch";
import {
  EMPTY_FILTERS,
  filterCourseEntries,
  filterProfessorEntries,
  hasActiveFilters,
  type ExploreFilterState,
} from "../../lib/explore/exploreFilters";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { ExploreBackButton, useExploreHistory } from "./ExploreHistoryContext";
import { ExploreFilterBar } from "./ExploreFilterBar";
import { EXPLORE_ACCORDION_PAD_INLINE } from "./ExploreProfessorGradesLayout";
import { SearchResultCourseCard } from "./SearchResultCourseCard";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";
import { SearchResultProfessorCard } from "./SearchResultProfessorCard";

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) m.set(normalizeCourseCode(c.code), c.title);
  return m;
}

function buildTermNameById(terms: Term[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of terms) {
    const id = Number.parseInt(t.termId, 10);
    if (Number.isFinite(id)) m.set(id, t.name);
  }
  return m;
}

export function ExploreSearchInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <TextInput
      placeholder={tr("explore.searchPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      size="lg"
      radius={9999}
      disabled={disabled}
      w="100%"
      autoComplete="off"
      aria-label={tr("explore.searchPlaceholder")}
      styles={{
        root: { width: "100%" },
        input: {
          backgroundColor: "#1a1b1e",
          borderColor: "#3f424a",
          minHeight: 48,
          paddingInline: 18,
          fontSize: "var(--mantine-font-size-md)",
          boxShadow: "0 1px 6px rgba(0, 0, 0, 0.22)",
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
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.06em" }}>
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
            scrollbarColor: "#3f424a transparent",
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

export function ExploreLayout({
  showBackButton = false,
  catalogue,
  terms,
  professorRatings,
  initialQuery = "",
  onQueryChange,
  children,
}: {
  showBackButton?: boolean;
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
  initialQuery?: string;
  onQueryChange?: (v: string) => void;
  children: ReactNode;
}) {
  useLingui();
  const { loading, data: grades } = useCourseGradesPb();
  const navigate = useNavigate();
  const { stack, pop } = useExploreHistory();
  const disciplines = useAppStore(useShallow((s) => s.disciplines));

  const [query, setQueryState] = useState(initialQuery);
  const [debouncedQuery] = useDebouncedValue(query, 120);
  const [filters, setFilters] = useState<ExploreFilterState>(EMPTY_FILTERS);

  const handleQueryChange = (v: string) => {
    setQueryState(v);
    onQueryChange?.(v);
  };

  const handleFilterChange = (next: Partial<ExploreFilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    if (!grades) return [];
    return buildExploreOfferings(grades, titleByCode, termNameById);
  }, [grades, titleByCode, termNameById]);

  const courseEntries = useMemo(
    () => buildCourseSearchEntries(offerings, titleByCode, professorRatings),
    [offerings, titleByCode, professorRatings],
  );
  const professorEntries = useMemo(
    () => buildExploreProfessorSearchEntries(offerings, professorRatings),
    [offerings, professorRatings],
  );
  const courseFuse = useMemo(
    () => (courseEntries.length === 0 ? null : createExploreCourseFuse(courseEntries)),
    [courseEntries],
  );

  const activeFilters = hasActiveFilters(filters);

  const rawSearchResults = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q || !courseFuse) return null;
    return searchExplore(q, { courseFuse, courseEntries, professorEntries });
  }, [debouncedQuery, courseFuse, courseEntries, professorEntries]);

  const searchResults = useMemo(() => {
    if (!rawSearchResults) return null;
    if (!activeFilters) return rawSearchResults;
    return {
      ...rawSearchResults,
      courses: filterCourseEntries(rawSearchResults.courses, filters),
      professors: filterProfessorEntries(rawSearchResults.professors, filters),
    };
  }, [rawSearchResults, activeFilters, filters]);

  const filterOnlyCourses = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q || !activeFilters) return null;
    return filterCourseEntries(courseEntries, filters)
      .slice()
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode, "en"))
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

  const showResults = debouncedQuery.trim().length > 0 || activeFilters;
  const hasResults =
    (searchResults?.courses.length ?? 0) > 0 ||
    (filterOnlyCourses?.length ?? 0) > 0 ||
    (searchResults?.professors.length ?? 0) > 0 ||
    disciplineResults.length > 0;

  const displayedCourses = filterOnlyCourses ?? searchResults?.courses ?? [];

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
            <SearchResultCourseCard entry={entry} query={debouncedQuery} />
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
            />
          </motion.div>
        ))}
      </SearchCardSection>
    ) : null;

  const orderedSections = searchResults?.professorsFirst
    ? [professorsSection, coursesSection, disciplinesSection]
    : [coursesSection, disciplinesSection, professorsSection];

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        backgroundColor: "#141517",
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
        {showBackButton ? (
          <Box mb={8}>
            {stack.length > 0 ? (
              <ExploreBackButton
                entry={stack[stack.length - 1]}
                onBack={() => {
                  const entry = stack[stack.length - 1];
                  pop();
                  void navigate({
                    to: entry.to,
                    params: entry.params as Record<string, string>,
                    search: { q: entry.search?.q },
                  });
                }}
              />
            ) : (
              <ExploreBackButton
                entry={{ to: "/explore", label: tr("explore.title") }}
                onBack={() => void navigate({ to: "/explore", search: { q: undefined } })}
              />
            )}
          </Box>
        ) : null}
        <Stack gap="md" maw={520}>
          <Title
            order={showBackButton ? 3 : 2}
            c="#F8F9FA"
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
          <ExploreSearchInput value={query} onChange={handleQueryChange} disabled={loading} />
          <ExploreFilterBar filters={filters} onChange={handleFilterChange} />
        </Stack>
      </Box>

      {/* Content area */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          paddingBottom: showResults ? 48 : 0,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {showResults ? (
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
                      c="violet.4"
                      mt={4}
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                      onClick={() => setFilters(EMPTY_FILTERS)}
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
