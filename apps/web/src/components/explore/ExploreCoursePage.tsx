import { Accordion, Box, Flex, Group, Stack, Text, Title } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import { IconClock } from "@tabler/icons-react";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { useShallow } from "zustand/react/shallow";
import { useTr, tr } from "../../i18n";
import { useAppStore } from "../../store/appStore";
import { formatTermLabel } from "../../lib/term/termLabel";
import {
  type ProfessorOfferingGroup,
  groupOfferingsByProfessor,
  resolveComponentId,
} from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import { useCourseFeedbackViews } from "../../hooks/useFeedbackViews";
import { FeedbackSummaryCard } from "./feedback/FeedbackSummaryCard";
import type { BackState } from "../../lib/navigation/backState";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { courseNormToPathParam, parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";

const EXPLORE_CHEVRON_RIGHT = {
  base: `calc(12px)`,
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

function CourseProfessorItem({
  group,
  professorRatings,
  currentEntry,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: BackState;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          stopPropagation
          currentEntry={currentEntry}
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
  const { loading, offeringsByCourseNorm, offeringsByComponent, aliasGroups, getTermPresence } =
    useExploreOfferings();
  const navigate = useNavigate();
  const terms = useAppStore(useShallow((s) => s.terms));

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const componentId = useMemo(
    () => (urlNorm === null ? null : resolveComponentId(urlNorm, aliasGroups.componentByNorm)),
    [urlNorm, aliasGroups],
  );

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

  const professorGroups = useMemo(
    () => groupOfferingsByProfessor(courseOfferings),
    [courseOfferings],
  );

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
    if (!selectedCourseMeta) return undefined;
    return {
      to: "/explore/course/$course",
      params: { course: urlCourseParam },
      label: selectedCourseMeta.courseCode,
    };
  }, [selectedCourseMeta, urlCourseParam]);

  const { views: feedbackViews, loading: feedbackLoading } = useCourseFeedbackViews(urlCourseParam);
  const showFeedback = feedbackLoading || feedbackViews.length > 0;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        {selectedCourseMeta ? (
          <Box
            pt={{ base: 4, md: 0 }}
            pb="md"
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
            }}
          >
            <Flex
              direction={{ base: "column", md: "row" }}
              gap="lg"
              align={{ base: "stretch", md: "center" }}
            >
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
                  {selectedCourseMeta.courseCode}
                </Title>
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
                          search={EMPTY_EXPLORE_SEARCH}
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
                {scheduleTerms.length > 0 ? (
                  <Group gap={8} mt={12}>
                    {scheduleTerms.map((termId) => (
                      <Link
                        key={termId}
                        to="/explore/course/$course/schedule"
                        params={{ course: urlCourseParam }}
                        search={{ ...EMPTY_EXPLORE_SEARCH, term: termId }}
                        state={{ back: courseEntry } as never}
                        style={{ textDecoration: "none" }}
                      >
                        <Group
                          gap={6}
                          wrap="nowrap"
                          px={12}
                          py={6}
                          className="soft-lift"
                          style={{
                            borderRadius: 9999,
                            border: "var(--app-border-width) solid var(--app-border-strong)",
                            backgroundColor: "var(--app-surface)",
                            color: "var(--app-text)",
                            fontWeight: 600,
                            fontSize: "var(--mantine-font-size-sm)",
                          }}
                        >
                          <IconClock size={14} stroke={1.7} />
                          {formatTermLabel(termId)}
                        </Group>
                      </Link>
                    ))}
                  </Group>
                ) : null}
              </Box>
              {showFeedback ? (
                <Box style={{ width: "100%", maxWidth: 420 }}>
                  <FeedbackSummaryCard
                    to="/explore/course/$course/feedback"
                    params={{ course: urlCourseParam }}
                    views={feedbackViews}
                    loading={feedbackLoading}
                  />
                </Box>
              ) : null}
            </Flex>
          </Box>
        ) : null}

        {professorGroups.length === 0 ? (
          <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
            <Text c="dimmed" size="sm">
              {loading ? null : tr("explore.courseNoProfessors")}
            </Text>
          </Box>
        ) : (
          <Box
            style={{
              width: "100vw",
              maxWidth: "100vw",
              marginInline: "calc(50% - 50vw)",
            }}
          >
            <Accordion
              multiple
              radius="var(--app-radius)"
              chevronPosition="right"
              variant="default"
              styles={{
                root: {
                  backgroundColor: "var(--app-bg)",
                  borderTop: "var(--app-border-width) solid var(--app-border)",
                },
                item: {
                  borderBottom: "var(--app-border-width) solid var(--app-border)",
                  backgroundColor: "var(--app-surface-sunken)",
                  "&:last-of-type": { borderBottom: "none" },
                },
                control: {
                  position: "relative",
                  paddingTop: "var(--mantine-spacing-lg)",
                  paddingBottom: "var(--mantine-spacing-lg)",
                  paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                  paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                  borderRadius: "var(--app-radius-sm)",
                  backgroundColor: "var(--app-surface-sunken)",
                  "@media (max-width: 540px)": {
                    paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                    paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
                  },
                  "&:hover": { backgroundColor: "var(--app-translucent)" },
                },
                label: { flex: 1, minWidth: 0, paddingRight: 0 },
                panel: { padding: 0, backgroundColor: "var(--app-bg)" },
                content: { padding: 0 },
                chevron: {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: EXPLORE_CHEVRON_RIGHT.xs,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: 0,
                  color: "var(--app-text-muted)",
                  "@media (max-width: 540px)": {
                    right: EXPLORE_CHEVRON_RIGHT.base,
                  },
                },
              }}
            >
              {professorGroups.map((g) => (
                <CourseProfessorItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                  currentEntry={courseEntry}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </m.div>
  );
}
