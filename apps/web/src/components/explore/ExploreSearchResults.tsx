import { Box, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import type {
  Discipline,
  Faculty,
  GradeVizData,
  NormalizedCourseCode,
  ProfessorRatingsMap,
} from "@uoplan/core";
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
import { facultyIndexRowFor } from "../../lib/explore/faculty";
import type { FacultyIndexRow } from "../../lib/explore/faculty";
import type { ExploreProgramSearchEntry } from "../../lib/explore/programSearch";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { SearchResultCourseCard } from "./SearchResultCourseCard";
import { SearchResultDisciplineCard } from "./SearchResultDisciplineCard";
import { SearchResultFacultyCard } from "./SearchResultFacultyCard";
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
  facultyResults: Faculty[];
  disciplines: Discipline[] | null;
  programResults: ExploreProgramSearchEntry[];
  disciplineCourseCount: Map<string, number>;
  professorRatings: ProfessorRatingsMap | null;
  currentSearchParams: ExploreSearchParams;
  virtualCourseComponents: ReadonlySet<NormalizedCourseCode>;
  deliveryActive: boolean;
  deliveryLoading: boolean;
  schedulesError: string | null;
  retrySchedules: () => void;
};

type SearchCardItem = { key: string; node: ReactNode };

function DeliveryStatusNotice({
  tone,
  message,
  onRetry,
}: {
  tone: "loading" | "warning" | "error";
  message: string;
  onRetry?: () => void;
}) {
  const role = tone === "error" ? "alert" : "status";
  const ariaLive = tone === "error" ? "assertive" : "polite";
  return (
    <Box
      role={role}
      aria-live={ariaLive}
      style={{
        padding: "12px 14px",
        borderRadius: "var(--mantine-radius-lg)",
        backgroundColor: "var(--app-surface)",
        border: "1px solid var(--app-border)",
      }}
    >
      <Group gap="sm" align="center" wrap="wrap" justify="space-between">
        <Group gap="xs" align="center" wrap="nowrap">
          {tone === "loading" ? <Loader size="xs" aria-hidden="true" /> : null}
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        </Group>
        {onRetry ? (
          <Button type="button" size="xs" radius="xl" variant="light" onClick={onRetry}>
            {tr("explore.filter.delivery.retry")}
          </Button>
        ) : null}
      </Group>
    </Box>
  );
}

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
      className="explore-search-section"
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
  deliveryActive,
  deliveryLoading,
  schedulesError,
  retrySchedules,
  professorsFirst,
  displayedCourses,
  displayedProfessors,
  disciplineResults,
  facultyResults,
  disciplines,
  programResults,
  disciplineCourseCount,
  professorRatings,
  currentSearchParams,
  virtualCourseComponents,
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

  // Per-faculty: the set of discipline prefixes it owns, plus discipline/course counts.
  const facultyMeta = useMemo(() => {
    const meta = new Map<string, FacultyIndexRow>();
    for (const f of facultyResults) {
      meta.set(f.id, facultyIndexRowFor(f, disciplines, disciplineCourseCount));
    }
    return meta;
  }, [facultyResults, disciplines, disciplineCourseCount]);

  // Aggregate grade distribution + satisfaction per faculty (all courses across its disciplines).
  const facultyStats = useMemo(() => {
    const stats = new Map<string, AggregateStats>();
    for (const f of facultyResults) {
      const prefixes = facultyMeta.get(f.id)?.prefixes;
      if (!prefixes || prefixes.size === 0) {
        stats.set(f.id, { gradeViz: null, sentiment: null });
        continue;
      }
      const norms: string[] = [];
      for (const key of offeringsByCourseNorm.keys()) {
        const prefix = key.split(" ")[0];
        if (prefix && prefixes.has(prefix)) norms.push(key);
      }
      const sentimentValues: number[] = [];
      if (courseSentiment) {
        for (const [norm, value] of courseSentiment) {
          const prefix = norm.split(" ")[0];
          if (prefix && prefixes.has(prefix)) sentimentValues.push(value);
        }
      }
      stats.set(f.id, {
        gradeViz: aggregateGradeVizForCourseNorms(offeringsByCourseNorm, norms),
        sentiment: meanSentiment(sentimentValues),
      });
    }
    return stats;
  }, [facultyResults, facultyMeta, offeringsByCourseNorm, courseSentiment]);

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
              searchParams={currentSearchParams}
              virtual={virtualCourseComponents.has(entry.componentId)}
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
              searchParams={currentSearchParams}
            />
          ),
        }))}
      />
    ) : null;

  const facultiesSection =
    facultyResults.length > 0 ? (
      <SearchCardSection
        label={tr("explore.resultsFaculties")}
        delay={0.05}
        items={facultyResults.map((f) => ({
          key: f.id,
          node: (
            <SearchResultFacultyCard
              faculty={f}
              disciplineCount={facultyMeta.get(f.id)?.disciplineCount ?? 0}
              courseCount={facultyMeta.get(f.id)?.courseCount ?? 0}
              gradeViz={facultyStats.get(f.id)?.gradeViz ?? null}
              sentiment={facultyStats.get(f.id)?.sentiment ?? null}
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
            />
          ),
        }))}
      />
    ) : null;

  const orderedSections = professorsFirst
    ? [
        { key: "professors", node: professorsSection },
        { key: "courses", node: coursesSection },
        { key: "disciplines", node: disciplinesSection },
        { key: "faculties", node: facultiesSection },
        { key: "programs", node: programsSection },
      ]
    : [
        { key: "courses", node: coursesSection },
        { key: "disciplines", node: disciplinesSection },
        { key: "faculties", node: facultiesSection },
        { key: "programs", node: programsSection },
        { key: "professors", node: professorsSection },
      ];
  const renderedSections = orderedSections.map(({ key, node }) =>
    node ? <Box key={key}>{node}</Box> : null,
  );
  const scheduleWarning =
    !deliveryActive && schedulesError ? (
      <DeliveryStatusNotice
        tone="warning"
        message={tr("explore.filter.delivery.warning")}
        onRetry={retrySchedules}
      />
    ) : null;

  return (
    <m.div
      key="search-results"
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1 }}
    >
      {deliveryActive && deliveryLoading ? (
        <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingRight: 24 }} mt={8}>
          <DeliveryStatusNotice tone="loading" message={tr("explore.filter.delivery.loading")} />
        </Box>
      ) : deliveryActive && schedulesError ? (
        <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingRight: 24 }} mt={8}>
          <DeliveryStatusNotice
            tone="error"
            message={tr("explore.filter.delivery.error")}
            onRetry={retrySchedules}
          />
        </Box>
      ) : hasResults ? (
        <Stack gap={16} mt={8}>
          {scheduleWarning}
          <Stack gap={28}>{renderedSections}</Stack>
        </Stack>
      ) : (
        <Stack
          gap={12}
          mt={8}
          style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingRight: 24 }}
        >
          {scheduleWarning}
          <Box>
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
        </Stack>
      )}
    </m.div>
  );
}
