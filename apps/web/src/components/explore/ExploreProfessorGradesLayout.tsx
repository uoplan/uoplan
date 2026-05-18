import { Link } from "@tanstack/react-router";
import { Accordion, Box, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { ProfessorRatingsMap } from "schedule";
import { normalizeProfessorName, normalizeGradeVizDistribution } from "schedule";
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

/** Extract a short label from term label (e.g., "Fall Term 2024" → "Fall 2024") */
function shortTermLabel(termLabel: string): string {
  // Remove " Term" from labels like "Fall Term 2024"
  return termLabel.replace(" Term", "");
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

  // Calculate date range metadata
  const { totalSections, newestTermLabel, oldestTermLabel } = useMemo(() => {
    if (group.offerings.length === 0) {
      return { totalSections: 0, newestTermLabel: "", oldestTermLabel: "" };
    }
    // Find min/max termId to get date range
    let minTermId = group.offerings[0].termId;
    let maxTermId = group.offerings[0].termId;
    let minLabel = group.offerings[0].termLabel;
    let maxLabel = group.offerings[0].termLabel;

    for (const o of group.offerings) {
      if (o.termId < minTermId) {
        minTermId = o.termId;
        minLabel = o.termLabel;
      }
      if (o.termId > maxTermId) {
        maxTermId = o.termId;
        maxLabel = o.termLabel;
      }
    }
    return {
      totalSections: group.offerings.length,
      newestTermLabel: maxLabel,
      oldestTermLabel: minLabel,
    };
  }, [group.offerings]);

  // Format metadata text: "X sections from Fall 2020 to Winter 2025"
  let metadata: string;
  if (totalSections === 0) {
    metadata = "";
  } else if (totalSections === 1 || newestTermLabel === oldestTermLabel) {
    metadata = `${totalSections} section${totalSections !== 1 ? "s" : ""} in ${shortTermLabel(newestTermLabel)}`;
  } else {
    metadata = `${totalSections} section${totalSections !== 1 ? "s" : ""} from ${shortTermLabel(oldestTermLabel)} to ${shortTermLabel(newestTermLabel)}`;
  }

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
        {metadata ? (
          <Text size="xs" c="dimmed">
            {metadata}
          </Text>
        ) : null}
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

function ExploreCourseSummaryBar({ group, currentEntry }: ExploreCourseSummaryBarProps) {
  const { push } = useExploreHistory();
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution)),
      ),
    [group.offerings],
  );

  // Calculate metadata - offerings are already sorted by termId descending
  const totalSections = group.offerings.length;
  const newestTermLabel = group.offerings[0]?.termLabel;
  const oldestTermLabel = group.offerings[group.offerings.length - 1]?.termLabel;

  // Format metadata text: "X sections from Fall 2020 to Winter 2025"
  let metadata: string;
  if (totalSections === 1 || newestTermLabel === oldestTermLabel) {
    metadata = `${totalSections} section${totalSections !== 1 ? "s" : ""} in ${shortTermLabel(newestTermLabel ?? "")}`;
  } else {
    metadata = `${totalSections} section${totalSections !== 1 ? "s" : ""} from ${shortTermLabel(oldestTermLabel ?? "")} to ${shortTermLabel(newestTermLabel ?? "")}`;
  }

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
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {metadata}
        </Text>
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
