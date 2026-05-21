import { Link } from "@tanstack/react-router";
import { Accordion, Box, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { ProfessorRatingsMap } from "@uoplan/schedule";
import { normalizeProfessorName, normalizeGradeVizDistribution } from "@uoplan/schedule";
import {
  GradeDistributionHistogram,
  GradeDistributionPassingSummary,
} from "../calendar/GradeDistributionViz";
import { tr } from "../../i18n";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { useExploreHistory, type ExploreHistoryEntry } from "./ExploreHistoryContext";
import {
  mergeGradeDistributionCounts,
  type CourseOfferingGroup,
  type ExploreOfferingFlat,
  type ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";

/** Mobile breakpoint for stacking histogram below text (in px). */
const MOBILE_BREAKPOINT_PX = 540;

/** Padding inline for accordion - responsive: smaller on mobile. */
export const EXPLORE_ACCORDION_PAD_INLINE = {
  base: "16px",
  xs: "max(24px, calc((100vw - min(100vw, 1200px)) / 2 + 24px))",
};

/** Space reserved beside content so accordion chevron does not shift histogram alignment. */
const EXPLORE_CHEVRON_GUTTER_PX = 40;

/** Padding right for accordion - responsive with chevron gutter. */
export const EXPLORE_ACCORDION_PAD_RIGHT = {
  base: `calc(16px + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
  xs: `calc(max(24px, calc((100vw - min(100vw, 1200px)) / 2 + 24px)) + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
};

/** Compact explore histogram width (accordion + professor rows). */
const EXPLORE_HISTOGRAM_WIDTH_PX = 288;

/** CSS media query for mobile stacking. */
const mobileMediaQuery = `@media (max-width: ${MOBILE_BREAKPOINT_PX}px)`;

function professorRatingLine(displayName: string, professorRatings: ProfessorRatingsMap | null) {
  if (!professorRatings) return null;
  const entry = professorRatings[normalizeProfessorName(displayName)];
  if (!entry || !Number.isFinite(entry.rating)) return null;
  return (
    <Text component="span" size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
      {entry.rating.toFixed(1)} · {entry.numRatings} ratings
    </Text>
  );
}

type ExploreProfessorSummaryBarProps = {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  stopPropagation?: boolean;
  currentEntry?: ExploreHistoryEntry;
};

export function ExploreProfessorSummaryBar({
  group,
  professorRatings,
  stopPropagation = false,
  currentEntry,
}: ExploreProfessorSummaryBarProps) {
  const { push } = useExploreHistory();
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution)),
      ),
    [group.offerings],
  );

  const ratingLine = professorRatingLine(group.displayName, professorRatings);

  return (
    <Box
      w="100%"
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--mantine-spacing-md)",
        [mobileMediaQuery]: {
          flexDirection: "column",
          alignItems: "stretch",
        },
      }}
    >
      <Stack gap={4} style={{ minWidth: 0, flex: "1 1 auto" }}>
        <Link
          to="/explore/professor/$legacyId"
          params={{
            legacyId:
              group.legacyId != null
                ? String(group.legacyId)
                : encodeURIComponent(group.displayName),
          }}
          search={EMPTY_EXPLORE_SEARCH}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            if (currentEntry) push(currentEntry);
          }}
          className="explore-name-link"
          style={{
            fontWeight: 600,
            color: "var(--mantine-color-gray-1)",
            display: "inline",
            alignSelf: "flex-start",
          }}
        >
          {group.displayName}
        </Link>
        {ratingLine}
        {combinedViz ? <GradeDistributionPassingSummary gradeViz={combinedViz} compact /> : null}
      </Stack>
      {combinedViz ? (
        <Box
          style={{
            flex: "0 0 auto",
            width: EXPLORE_HISTOGRAM_WIDTH_PX,
            maxWidth: EXPLORE_HISTOGRAM_WIDTH_PX,
            marginLeft: "auto",
            [mobileMediaQuery]: {
              width: "100%",
              maxWidth: "100%",
              marginLeft: 0,
            },
          }}
        >
          <GradeDistributionHistogram gradeViz={combinedViz} variant="compact" showStudentCount />
        </Box>
      ) : null}
    </Box>
  );
}

type ExploreCourseSummaryBarProps = {
  group: CourseOfferingGroup;
  currentEntry?: ExploreHistoryEntry;
};

export function ExploreCourseSummaryBar({ group, currentEntry }: ExploreCourseSummaryBarProps) {
  const { push } = useExploreHistory();
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution)),
      ),
    [group.offerings],
  );

  return (
    <Box
      w="100%"
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--mantine-spacing-md)",
        [mobileMediaQuery]: {
          flexDirection: "column",
          alignItems: "stretch",
        },
      }}
    >
      <Stack gap={4} style={{ minWidth: 0, flex: "1 1 auto" }}>
        <Link
          to="/explore/course/$course"
          params={{ course: courseNormToPathParam(group.groupId) }}
          search={EMPTY_EXPLORE_SEARCH}
          onClick={(e) => {
            e.stopPropagation();
            if (currentEntry) push(currentEntry);
          }}
          className="explore-name-link"
          style={{
            fontWeight: 600,
            color: "var(--mantine-color-gray-1)",
            display: "inline",
            alignSelf: "flex-start",
          }}
        >
          {group.courseCode}
        </Link>
        {group.courseTitles.length > 0 && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {group.courseTitles.join(" · ")}
          </Text>
        )}
        {combinedViz ? <GradeDistributionPassingSummary gradeViz={combinedViz} compact /> : null}
      </Stack>
      {combinedViz ? (
        <Box
          style={{
            flex: "0 0 auto",
            width: EXPLORE_HISTOGRAM_WIDTH_PX,
            maxWidth: EXPLORE_HISTOGRAM_WIDTH_PX,
            marginLeft: "auto",
            [mobileMediaQuery]: {
              width: "100%",
              maxWidth: "100%",
              marginLeft: 0,
            },
          }}
        >
          <GradeDistributionHistogram gradeViz={combinedViz} variant="compact" showStudentCount />
        </Box>
      ) : null}
    </Box>
  );
}

type ExploreCourseItemProps = {
  group: CourseOfferingGroup;
  currentEntry?: ExploreHistoryEntry;
};

export function ExploreCourseItem({ group, currentEntry }: ExploreCourseItemProps) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreCourseSummaryBar group={group} currentEntry={currentEntry} />
      </Accordion.Control>
      <Accordion.Panel>
        <ExploreProfessorOfferingRows offerings={group.offerings} showCourseCode={false} />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

type ExploreProfessorOfferingRowsProps = {
  offerings: ExploreOfferingFlat[];
  showCourseCode?: boolean;
};

export function ExploreProfessorOfferingRows({
  offerings,
  showCourseCode = false,
}: ExploreProfessorOfferingRowsProps) {
  return (
    <Stack gap={0}>
      {offerings.map((o, index) => {
        const sectionViz = normalizeGradeVizDistribution(o.distribution);
        const isLast = index === offerings.length - 1;
        return (
          <Paper
            key={o.id}
            radius={0}
            style={{
              backgroundColor: "#141517",
              borderBottom: isLast ? undefined : "1px solid #2c2e33",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              paddingTop: "var(--mantine-spacing-lg)",
              paddingBottom: "var(--mantine-spacing-lg)",
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
              [mobileMediaQuery]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              },
            }}
          >
            <Box
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--mantine-spacing-md)",
                [mobileMediaQuery]: {
                  flexDirection: "column",
                  alignItems: "stretch",
                },
              }}
            >
              <Stack gap={6} style={{ minWidth: 0, flex: "1 1 auto" }}>
                {showCourseCode ? (
                  <Stack gap={2}>
                    <Text size="sm" fw={600} c="gray.2">
                      {o.courseCode}
                    </Text>
                    {o.courseTitle ? (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {o.courseTitle}
                      </Text>
                    ) : null}
                  </Stack>
                ) : null}
                <Group gap="xs" wrap="wrap" align="baseline">
                  <Text size="sm" fw={600} c="gray.2">
                    {o.termLabel}
                  </Text>
                  {o.section ? (
                    <Text size="xs" c="dimmed">
                      {tr("explore.section", { section: o.section })}
                    </Text>
                  ) : null}
                </Group>
                {sectionViz ? (
                  <GradeDistributionPassingSummary gradeViz={sectionViz} compact />
                ) : (
                  <Text size="xs" c="dimmed">
                    {tr("explore.sectionNoGrades")}
                  </Text>
                )}
              </Stack>
              {sectionViz ? (
                <Box
                  style={{
                    flex: "0 0 auto",
                    width: EXPLORE_HISTOGRAM_WIDTH_PX,
                    maxWidth: EXPLORE_HISTOGRAM_WIDTH_PX,
                    marginLeft: "auto",
                    [mobileMediaQuery]: {
                      width: "100%",
                      maxWidth: "100%",
                      marginLeft: 0,
                    },
                  }}
                >
                  <GradeDistributionHistogram
                    gradeViz={sectionViz}
                    variant="compact"
                    showStudentCount
                  />
                </Box>
              ) : null}
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
}
