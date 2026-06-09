import { Box, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { Discipline, ProfessorRatingsMap } from "@uoplan/core";
import {
  courseSentimentByNorm,
  normalizeProfessorName,
  professorSentimentByName,
} from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import type {
  ExploreCourseSearchEntry,
  ExploreProfessorSearchEntry,
} from "../../lib/explore/gradesSearch";
import type { ExploreProgramSearchEntry } from "../../lib/explore/programSearch";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { SearchResultCourseCard } from "./SearchResultCourseCard";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";
import { SearchResultProfessorCard } from "./SearchResultProfessorCard";
import { SearchResultProgramCard } from "./SearchResultProgramCard";
import type { ReactNode } from "react";

type ExploreSearchResultsProps = {
  hasResults: boolean;
  activeFilters: boolean;
  query: string;
  debouncedQuery: string;
  onClearFilters: () => void;
  professorsFirst: boolean;
  displayedCourses: ExploreCourseSearchEntry[];
  displayedProfessors: ExploreProfessorSearchEntry[];
  disciplineResults: Discipline[];
  programResults: ExploreProgramSearchEntry[];
  disciplineCourseCount: Map<string, number>;
  professorRatings: ProfessorRatingsMap | null;
  currentSearchParams: ExploreSearchParams;
};

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
    <m.div
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
          }}
        >
          <Box style={{ display: "flex", gap: 10, width: "max-content" }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {children}
            </AnimatePresence>
          </Box>
        </Box>
      </Stack>
    </m.div>
  );
}

export function ExploreSearchResults({
  hasResults,
  activeFilters,
  query,
  debouncedQuery,
  onClearFilters,
  professorsFirst,
  displayedCourses,
  displayedProfessors,
  disciplineResults,
  programResults,
  disciplineCourseCount,
  professorRatings,
  currentSearchParams,
}: ExploreSearchResultsProps) {
  useTr();

  // Lazily load the course-evaluation dataset so every card can show its overall
  // satisfaction; the numbers fill in once the (~900 KB) asset has decoded.
  const { data: feedback } = useFeedbackData();
  const courseSentiment = useMemo(
    () => (feedback ? courseSentimentByNorm(feedback) : null),
    [feedback],
  );
  const professorSentiment = useMemo(
    () => (feedback ? professorSentimentByName(feedback) : null),
    [feedback],
  );

  const coursesSection =
    displayedCourses.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsCourses")} delay={0}>
        {displayedCourses.map((entry) => (
          <m.div
            key={entry.normCode}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultCourseCard
              entry={entry}
              sentiment={courseSentiment?.get(entry.normCode) ?? null}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          </m.div>
        ))}
      </SearchCardSection>
    ) : null;

  const disciplinesSection =
    disciplineResults.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsDisciplines")} delay={0.04}>
        {disciplineResults.map((d) => (
          <m.div
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
          </m.div>
        ))}
      </SearchCardSection>
    ) : null;

  const professorsSection =
    displayedProfessors.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsProfessors")} delay={0.06}>
        {displayedProfessors.map((entry) => (
          <m.div
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
              sentiment={professorSentiment?.get(normalizeProfessorName(entry.displayName)) ?? null}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          </m.div>
        ))}
      </SearchCardSection>
    ) : null;

  const programsSection =
    programResults.length > 0 ? (
      <SearchCardSection label={tr("explore.resultsPrograms")} delay={0.08}>
        {programResults.map((program) => (
          <m.div
            key={program.slug}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ flexShrink: 0 }}
          >
            <SearchResultProgramCard program={program} query={debouncedQuery} />
          </m.div>
        ))}
      </SearchCardSection>
    ) : null;

  const orderedSections = professorsFirst
    ? [professorsSection, coursesSection, disciplinesSection, programsSection]
    : [coursesSection, disciplinesSection, programsSection, professorsSection];

  return (
    <m.div
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
        <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingRight: 24 }} mt={8}>
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
              onClick={onClearFilters}
            >
              {tr("explore.filter.clearFilters")}
            </Text>
          )}
        </Box>
      )}
    </m.div>
  );
}
