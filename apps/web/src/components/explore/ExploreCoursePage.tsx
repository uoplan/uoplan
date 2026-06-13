import { Accordion, Box, Group, Stack, Text, Title } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import { IconClock } from "@tabler/icons-react";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { useShallow } from "zustand/react/shallow";
import { tr, useTr } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { formatTermLabel } from "../../lib/term/termLabel";
import type {
  ExploreOfferingFlat,
  ExploreProfessorSearchEntry,
  ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH, hasActiveFilters } from "../../lib/explore/exploreFilters";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import {
  courseMatchesCourseLevelFilters,
  filterCourseProfessorGroups,
} from "../../lib/explore/detailFilters";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useExploreDetailFilters } from "./useExploreDetailFilters";
import { CatalogueLink } from "./CatalogueLink";
import { useCourseFeedbackViews } from "../../hooks/useFeedbackViews";
import { FeedbackSummaryCard } from "./feedback/FeedbackSummaryCard";
import type { BackState } from "../../lib/navigation/backState";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import {
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { useCourseAliasResolution } from "../../hooks/useCourseAliasResolution";
import { AddToBasketButton } from "../basket/AddToBasketButton";
import {
  ExploreAccordion,
  ExploreEntityHeader,
  ExploreFeedbackAside,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

/**
 * A single schedule-term chip (clock icon + term label) shown under the course
 * title. Rendered `hidden` (occupying its normal height but invisible) to reserve
 * the pill row's vertical space when a course has no schedule terms yet / at all,
 * so the row never shifts the content below it when the terms load in.
 */
function TermPillChip({ label, hidden = false }: { label?: string; hidden?: boolean }) {
  return (
    <Group
      gap={6}
      wrap="nowrap"
      px={12}
      py={6}
      className={hidden ? undefined : "soft-lift"}
      aria-hidden={hidden || undefined}
      style={{
        borderRadius: 9999,
        border: "var(--app-border-width) solid var(--app-border-strong)",
        backgroundColor: "var(--app-surface)",
        color: "var(--app-text)",
        fontWeight: 600,
        fontSize: "var(--mantine-font-size-sm)",
        visibility: hidden ? "hidden" : undefined,
      }}
    >
      <IconClock size={14} stroke={1.7} />
      {hidden ? "\u00A0" : label}
    </Group>
  );
}

function CourseProfessorItem({
  group,
  professorRatings,
  currentEntry,
  aggregateOfferings,
  linkSearch,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: BackState;
  aggregateOfferings?: ExploreOfferingFlat[];
  linkSearch?: ExploreSearchParams;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          stopPropagation
          currentEntry={currentEntry}
          aggregateOfferings={aggregateOfferings}
          linkSearch={linkSearch}
        />
      </Accordion.Control>
      <Accordion.Panel>
        <ExploreProfessorOfferingRows offerings={group.offerings} />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function ExploreCoursePage({
  urlCourseParam,
  professorRatings,
}: {
  urlCourseParam: string;
  professorRatings: ProfessorRatingsMap | null;
}) {
  useTr();
  const {
    loading,
    offeringsByCourseNorm,
    offeringsByComponent,
    aliasGroups,
    getTermPresence,
    getProfessorEntries,
    getCourseEntryByNorm,
  } = useExploreOfferings();
  const navigate = useNavigate();
  const terms = useAppStore(useShallow((s) => s.terms));
  const registry = useAppStore(useShallow((s) => s.professors));

  const { filters, sentiment, requirementCandidateSet, linkSearch } = useExploreDetailFilters();

  const { urlNorm, componentId } = useCourseAliasResolution(urlCourseParam, aliasGroups);

  const courseOfferings = useMemo(() => {
    if (urlNorm === null || componentId === null) return [];
    return offeringsByComponent.get(componentId) ?? offeringsByCourseNorm.get(urlNorm) ?? [];
  }, [offeringsByComponent, offeringsByCourseNorm, componentId, urlNorm]);

  // Redirect to /explore if course has no offerings once data loads.
  useEffect(() => {
    if (loading || urlNorm == null) return;
    if (courseOfferings.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, urlNorm, courseOfferings, navigate]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null || courseOfferings.length === 0) return null;
    // Display the requested code (the one the user navigated to), even when the data is
    // sourced from an aliased member code.
    const requested = courseOfferings.find((o) => normalizeCourseCode(o.courseCode) === urlNorm);
    const courseCode = requested?.courseCode ?? urlNorm;
    const courseTitle = requested?.courseTitle ?? courseOfferings[0].courseTitle;
    return { courseCode, courseTitle };
  }, [loading, urlNorm, courseOfferings]);

  // Other codes in the same alias group that actually have data, for the "also known as" note.
  const aliasCodes = useMemo(() => {
    if (urlNorm == null || componentId == null) return [];
    const members = aliasGroups.membersByComponent.get(componentId);
    if (!members) return [];
    return members.filter((m) => m !== urlNorm && offeringsByCourseNorm.has(m));
  }, [urlNorm, componentId, aliasGroups, offeringsByCourseNorm]);

  const profEntryByGroupId = useMemo(() => {
    if (filters.minRating === null && filters.minFeedback === null) {
      return new Map<string, ExploreProfessorSearchEntry>();
    }
    return new Map(getProfessorEntries().map((e) => [e.groupId, e] as const));
  }, [filters.minRating, filters.minFeedback, getProfessorEntries]);

  const { groups: professorGroups, aggregateByGroupId } = useMemo(
    () =>
      filterCourseProfessorGroups(courseOfferings, filters, {
        profEntryByGroupId,
        sentiment,
        registry,
      }),
    [courseOfferings, filters, profEntryByGroupId, sentiment, registry],
  );

  // Course-level filters (level / language / discipline / difficulty / requirements)
  // describe the whole course: when it doesn't match, hide every professor.
  const courseSearchEntry = useMemo(
    () => (urlNorm == null ? undefined : getCourseEntryByNorm().get(urlNorm)),
    [urlNorm, getCourseEntryByNorm],
  );
  const courseMatchesFilters = useMemo(
    () => courseMatchesCourseLevelFilters(courseSearchEntry, filters, requirementCandidateSet),
    [courseSearchEntry, filters, requirementCandidateSet],
  );
  const displayedProfessorGroups = courseMatchesFilters ? professorGroups : [];

  // Schedule terms (those with timetables) in which this course is offered,
  // most recent first — each deep-links into the course-times schedule page.
  const scheduleTerms = useMemo(() => {
    if (componentId === null || !terms || terms.length === 0) return [];
    const presence = getTermPresence();
    const ids: number[] = [];
    for (const t of terms) {
      const termId = Number(t.termId);
      if (!Number.isFinite(termId)) continue;
      if (!presence.courseComponentsByTerm.get(termId)?.has(componentId)) continue;
      ids.push(termId);
    }
    return ids.sort((a, b) => b - a);
  }, [componentId, terms, getTermPresence]);

  const courseEntry = useMemo<BackState | undefined>(() => {
    if (!selectedCourseMeta) return;
    return {
      to: "/explore/course/$course",
      params: { course: urlCourseParam },
      label: selectedCourseMeta.courseCode,
    };
  }, [selectedCourseMeta, urlCourseParam]);

  const { views: feedbackViews, loading: feedbackLoading } = useCourseFeedbackViews(urlCourseParam);
  const showFeedback = feedbackLoading || feedbackViews.length > 0;

  const catalogueUrl = useMemo(() => {
    if (!selectedCourseMeta) return null;
    const params = new URLSearchParams({ P: selectedCourseMeta.courseCode });
    return `https://catalogue.uottawa.ca/search/?${params.toString()}`;
  }, [selectedCourseMeta]);

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        {selectedCourseMeta ? (
          <ExploreEntityHeader
            aside={
              showFeedback ? (
                <ExploreFeedbackAside>
                  <FeedbackSummaryCard
                    to="/explore/course/$course/feedback"
                    params={{ course: urlCourseParam }}
                    views={feedbackViews}
                    loading={feedbackLoading}
                  />
                </ExploreFeedbackAside>
              ) : null
            }
          >
            <Group gap={8} align="center" wrap="nowrap">
              <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
                {selectedCourseMeta.courseCode}
              </Title>
              <AddToBasketButton code={selectedCourseMeta.courseCode} variant="labeled" />
              {catalogueUrl ? (
                <CatalogueLink href={catalogueUrl} label={tr("explore.openInCatalogue")} />
              ) : null}
            </Group>
            {selectedCourseMeta.courseTitle ? (
              <Text size="sm" c="dimmed" lh={1.5} mt={8}>
                {selectedCourseMeta.courseTitle}
              </Text>
            ) : null}
            {aliasCodes.length > 0 ? (
              <Text size="sm" c="dimmed" lh={1.5} mt={8}>
                {tr("explore.alsoKnownAs")}{" "}
                {aliasCodes.map((code, i) => (
                  <span key={code}>
                    {i > 0 ? ", " : null}
                    <Link
                      to="/explore/course/$course"
                      params={{ course: courseNormToPathParam(code) }}
                      search={linkSearch}
                      state={{ back: courseEntry } as never}
                      style={{
                        color: "var(--app-text)",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      {code}
                    </Link>
                  </span>
                ))}
              </Text>
            ) : null}
            <Group gap={8} mt={12}>
              {scheduleTerms.length > 0 ? (
                scheduleTerms.map((termId) => (
                  <Link
                    key={termId}
                    to="/explore/course/$course/schedule"
                    params={{ course: urlCourseParam }}
                    search={{ ...EMPTY_EXPLORE_SEARCH, term: termId }}
                    state={{ back: courseEntry } as never}
                    style={{ textDecoration: "none" }}
                  >
                    <TermPillChip label={formatTermLabel(termId)} />
                  </Link>
                ))
              ) : (
                <TermPillChip hidden />
              )}
            </Group>
          </ExploreEntityHeader>
        ) : null}

        {displayedProfessorGroups.length === 0 ? (
          <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
            <Text c="dimmed" size="sm">
              {loading
                ? null
                : hasActiveFilters(filters)
                  ? tr("explore.courseNoProfessorsForFilters")
                  : tr("explore.courseNoProfessors")}
            </Text>
          </Box>
        ) : (
          <ExploreFullBleed>
            <ExploreAccordion chevronRightBase="calc(12px)">
              {displayedProfessorGroups.map((g) => (
                <CourseProfessorItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                  currentEntry={courseEntry}
                  aggregateOfferings={aggregateByGroupId?.get(g.groupId)}
                  linkSearch={linkSearch}
                />
              ))}
            </ExploreAccordion>
          </ExploreFullBleed>
        )}
      </Stack>
    </m.div>
  );
}
