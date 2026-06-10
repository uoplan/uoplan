import { Box, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { Discipline, GradeVizData, ProfessorRatingsMap } from "@uoplan/core";
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
import { aggregateGradeVizForCourseNorms } from "../../lib/explore/gradesSearch";
import type { ExploreProgramSearchEntry } from "../../lib/explore/programSearch";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { SearchResultCourseCard } from "./SearchResultCourseCard";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";
import { SearchResultProfessorCard } from "./SearchResultProfessorCard";
import { SearchResultProgramCard } from "./SearchResultProgramCard";
import type { ReactNode } from "react";

type AggregateStats = { gradeViz: GradeVizData | null; sentiment: number | null };

function meanSentiment(values: Iterable<number | undefined>): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v != null) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

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

type SearchCardItem = { key: string; node: ReactNode };

function SearchCardSection({
  label,
  delay = 0,
  items,
}: {
  label: string;
  delay?: number;
  items: SearchCardItem[];
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
              {items.map((item) => (
                <m.div
                  key={item.key}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  style={{ flexShrink: 0 }}
                >
                  {item.node}
                </m.div>
              ))}
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
  const { offeringsByCourseNorm } = useExploreOfferings();
  const courseSentiment = useMemo(
    () => (feedback ? courseSentimentByNorm(feedback) : null),
    [feedback],
  );
  const professorSentiment = useMemo(
    () => (feedback ? professorSentimentByName(feedback) : null),
    [feedback],
  );

  // Aggregate grade distribution + satisfaction per discipline (all courses whose code
  // shares the discipline prefix) for the discipline cards.
  const disciplineStats = useMemo(() => {
    const stats = new Map<string, AggregateStats>();
    for (const d of disciplineResults) {
      const prefix = d.code.toUpperCase();
      const norms: string[] = [];
      for (const key of offeringsByCourseNorm.keys()) {
        if (key.split(" ")[0] === prefix) norms.push(key);
      }
      const sentimentValues: number[] = [];
      if (courseSentiment) {
        for (const [norm, value] of courseSentiment) {
          if (norm.split(" ")[0] === prefix) sentimentValues.push(value);
        }
      }
      stats.set(d.code, {
        gradeViz: aggregateGradeVizForCourseNorms(offeringsByCourseNorm, norms),
        sentiment: meanSentiment(sentimentValues),
      });
    }
    return stats;
  }, [disciplineResults, offeringsByCourseNorm, courseSentiment]);

  // Aggregate grade distribution + satisfaction per program (its core/required courses).
  const programStats = useMemo(() => {
    const stats = new Map<string, AggregateStats>();
    for (const p of programResults) {
      const sentiment = courseSentiment
        ? meanSentiment(p.coreCodes.map((code) => courseSentiment.get(code)))
        : null;
      stats.set(p.slug, {
        gradeViz: aggregateGradeVizForCourseNorms(offeringsByCourseNorm, p.coreCodes),
        sentiment,
      });
    }
    return stats;
  }, [programResults, offeringsByCourseNorm, courseSentiment]);

  const coursesSection =
    displayedCourses.length > 0 ? (
      <SearchCardSection
        label={tr("explore.resultsCourses")}
        delay={0}
        items={displayedCourses.map((entry) => ({
          key: entry.normCode,
          node: (
            <SearchResultCourseCard
              entry={entry}
              sentiment={courseSentiment?.get(entry.normCode) ?? null}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          ),
        }))}
      />
    ) : null;

  const disciplinesSection =
    disciplineResults.length > 0 ? (
      <SearchCardSection
        label={tr("explore.resultsDisciplines")}
        delay={0.04}
        items={disciplineResults.map((d) => ({
          key: d.code,
          node: (
            <SearchResultDisciplineCard
              discipline={d}
              courseCount={disciplineCourseCount.get(d.code) ?? 0}
              gradeViz={disciplineStats.get(d.code)?.gradeViz ?? null}
              sentiment={disciplineStats.get(d.code)?.sentiment ?? null}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          ),
        }))}
      />
    ) : null;

  const professorsSection =
    displayedProfessors.length > 0 ? (
      <SearchCardSection
        label={tr("explore.resultsProfessors")}
        delay={0.06}
        items={displayedProfessors.map((entry) => ({
          key: entry.groupId,
          node: (
            <SearchResultProfessorCard
              entry={entry}
              professorRatings={professorRatings}
              sentiment={professorSentiment?.get(normalizeProfessorName(entry.displayName)) ?? null}
              query={debouncedQuery}
              searchParams={currentSearchParams}
            />
          ),
        }))}
      />
    ) : null;

  const programsSection =
    programResults.length > 0 ? (
      <SearchCardSection
        label={tr("explore.resultsPrograms")}
        delay={0.08}
        items={programResults.map((program) => ({
          key: program.slug,
          node: (
            <SearchResultProgramCard
              program={program}
              gradeViz={programStats.get(program.slug)?.gradeViz ?? null}
              sentiment={programStats.get(program.slug)?.sentiment ?? null}
              query={debouncedQuery}
            />
          ),
        }))}
      />
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
