import { Accordion, Badge, Box, Group, Text, Title, Tooltip } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { IconClock } from "@tabler/icons-react";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeCourseCode, normalizeProfessorName } from "@uoplan/core";
import { i18n, tr, useTr } from "../../i18n";
import {
  useDataCache,
  useDisciplines,
  useFaculties,
  useProfessorRegistry,
  useTerms,
} from "../../store/hooks";
import { facultyForDisciplineCode, localizeFacultyName } from "../../lib/explore/faculty";
import { formatTermLabel } from "../../lib/term/termLabel";
import type {
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
import { ExplorePageTransition } from "./ExplorePageTransition";
import { useCourseFeedbackViews } from "../../hooks/useFeedbackViews";
import { FeedbackSummaryCard } from "./feedback/FeedbackSummaryCard";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import {
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { useCourseAliasResolution } from "../../hooks/useCourseAliasResolution";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
import { usePublishBasketTarget } from "./exploreBasketTargetContext";
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
  sentiment,
  linkSearch,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  sentiment?: number | null;
  linkSearch?: ExploreSearchParams;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          sentiment={sentiment}
          stopPropagation
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
  const terms = useTerms();
  const registry = useProfessorRegistry();
  const disciplines = useDisciplines();
  const faculties = useFaculties();
  const dataCache = useDataCache();

  const { filters, sentiment, requirementCandidateSet, linkSearch } = useExploreDetailFilters();

  // Per-professor course-feedback satisfaction (1-5) for the RatingBadge row, loaded
  // lazily from the feedback dataset (independent of the active feedback filter).
  const { professorByName } = useScheduleSentiment();

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

  usePublishBasketTarget(selectedCourseMeta?.courseCode ?? null);

  const catalogueCourse = useMemo(() => {
    if (!dataCache) return;
    const courseCode = selectedCourseMeta?.courseCode ?? urlNorm;
    if (!courseCode) return;
    return dataCache.getCourse(courseCode);
  }, [dataCache, selectedCourseMeta?.courseCode, urlNorm]);

  const courseCredits =
    catalogueCourse && Number.isFinite(catalogueCourse.credits) ? catalogueCourse.credits : null;

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

  const { groups: professorGroups } = useMemo(
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

  const { views: feedbackViews, loading: feedbackLoading } = useCourseFeedbackViews(urlCourseParam);
  const showFeedback = feedbackLoading || feedbackViews.length > 0;

  const catalogueUrl = useMemo(() => {
    if (!selectedCourseMeta) return null;
    const params = new URLSearchParams({ P: selectedCourseMeta.courseCode });
    return `https://catalogue.uottawa.ca/search/?${params.toString()}`;
  }, [selectedCourseMeta]);

  const faculty = useMemo(() => {
    if (!selectedCourseMeta) return null;
    const subject = selectedCourseMeta.courseCode.split(/\s+/)[0] ?? "";
    return facultyForDisciplineCode(disciplines, faculties, subject);
  }, [selectedCourseMeta, disciplines, faculties]);
  const facultyName = faculty ? localizeFacultyName(faculty, i18n.locale) : null;

  return (
    <ExplorePageTransition>
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
            {catalogueUrl ? (
              <CatalogueLink href={catalogueUrl} label={tr("explore.openInCatalogue")} />
            ) : null}
          </Group>
          {selectedCourseMeta.courseTitle || facultyName || courseCredits !== null ? (
            <Group gap={8} mt={10} wrap="wrap">
              {selectedCourseMeta.courseTitle ? (
                <Tooltip
                  label={selectedCourseMeta.courseTitle}
                  multiline
                  w={320}
                  withArrow
                  position="bottom-start"
                >
                  <Badge
                    size="lg"
                    variant="light"
                    color="gray"
                    radius="sm"
                    maw={240}
                    style={{ minWidth: 0, textTransform: "none", cursor: "help" }}
                  >
                    {selectedCourseMeta.courseTitle}
                  </Badge>
                </Tooltip>
              ) : null}
              {faculty && facultyName ? (
                <Badge
                  size="lg"
                  variant="light"
                  color="gray"
                  radius="sm"
                  maw="100%"
                  style={{ textTransform: "none", cursor: "pointer" }}
                  renderRoot={(props) => (
                    <Link
                      to="/explore/faculty/$faculty"
                      params={{ faculty: faculty.id }}
                      search={linkSearch}
                      {...props}
                    />
                  )}
                >
                  {facultyName}
                </Badge>
              ) : null}
              {courseCredits !== null ? (
                <Badge
                  size="lg"
                  variant="light"
                  color="gray"
                  radius="sm"
                  style={{ textTransform: "none" }}
                >
                  {tr("explore.course.credits", { count: courseCredits })}
                </Badge>
              ) : null}
            </Group>
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
                sentiment={professorByName?.get(normalizeProfessorName(g.displayName)) ?? null}
                linkSearch={linkSearch}
              />
            ))}
          </ExploreAccordion>
        </ExploreFullBleed>
      )}
    </ExplorePageTransition>
  );
}
