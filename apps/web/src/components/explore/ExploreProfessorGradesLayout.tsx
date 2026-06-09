import { Link } from "@tanstack/react-router";
import { Accordion, Badge, Box, Group, HoverCard, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { ProfessorRatingsMap } from "@uoplan/core";
import {
  normalizeProfessorName,
  normalizeGradeVizDistribution,
  hasProfessorRatings,
} from "@uoplan/core";
import {
  GradeDistributionHistogram,
  GradeDistributionHistogramPlaceholder,
  GradeDistributionPassingSummary,
} from "../calendar/GradeDistributionViz";
import { tr, useTr } from "../../i18n";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { formatTermLabel } from "../../lib/term/termLabel";
import type { BackState } from "../../lib/navigation/backState";
import {
  mergeGradeDistributionCounts,
  type CourseOfferingGroup,
  type ExploreOfferingFlat,
  type ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
} from "../../lib/explore/accordionPadding";

/** Mobile breakpoint for stacking histogram below text (in px). */
const MOBILE_BREAKPOINT_PX = 540;

/** Compact explore histogram width (accordion + professor rows). */
const EXPLORE_HISTOGRAM_WIDTH_PX = 288;

/** CSS media query for mobile stacking. */
const mobileMediaQuery = `@media (max-width: ${MOBILE_BREAKPOINT_PX}px)`;

function professorRatingLine(displayName: string, professorRatings: ProfessorRatingsMap | null) {
  if (!professorRatings) return null;
  const entry = professorRatings[normalizeProfessorName(displayName)];
  if (!entry) return null;
  if (!hasProfessorRatings(entry)) {
    return (
      <Text component="span" size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {tr("search.noRating")}
      </Text>
    );
  }
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
  currentEntry?: BackState;
};

export function ExploreProfessorSummaryBar({
  group,
  professorRatings,
  stopPropagation = false,
  currentEntry,
}: ExploreProfessorSummaryBarProps) {
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution)),
      ),
    [group.offerings],
  );

  const ratingLine = group.unassigned
    ? null
    : professorRatingLine(group.displayName, professorRatings);

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
        {group.unassigned ? (
          <Text
            fw={600}
            c="var(--app-text-muted)"
            fs="italic"
            style={{ display: "inline", alignSelf: "flex-start" }}
          >
            {tr("explore.instructorUnassigned")}
          </Text>
        ) : (
          <Link
            to="/explore/professor/$legacyId"
            params={{
              legacyId:
                group.legacyId != null
                  ? String(group.legacyId)
                  : encodeURIComponent(group.displayName),
            }}
            search={EMPTY_EXPLORE_SEARCH}
            state={currentEntry ? ({ back: currentEntry } as never) : undefined}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
            }}
            className="explore-name-link"
            style={{
              fontWeight: 600,
              color: "var(--app-text)",
              display: "inline",
              alignSelf: "flex-start",
            }}
          >
            {group.displayName}
          </Link>
        )}
        {ratingLine}
        {combinedViz ? <GradeDistributionPassingSummary gradeViz={combinedViz} compact /> : null}
      </Stack>
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
        {combinedViz ? (
          <GradeDistributionHistogram gradeViz={combinedViz} variant="compact" showStudentCount />
        ) : (
          <GradeDistributionHistogramPlaceholder />
        )}
      </Box>
    </Box>
  );
}

type ExploreCourseSummaryBarProps = {
  group: CourseOfferingGroup;
  currentEntry?: BackState;
};

export function ExploreCourseSummaryBar({ group, currentEntry }: ExploreCourseSummaryBarProps) {
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
          state={currentEntry ? ({ back: currentEntry } as never) : undefined}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="explore-name-link"
          style={{
            fontWeight: 600,
            color: "var(--app-text)",
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
        {combinedViz ? (
          <GradeDistributionHistogram gradeViz={combinedViz} variant="compact" showStudentCount />
        ) : (
          <GradeDistributionHistogramPlaceholder />
        )}
      </Box>
    </Box>
  );
}

type ExploreCourseItemProps = {
  group: CourseOfferingGroup;
  currentEntry?: BackState;
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
  useTr();
  return (
    <Stack gap={0}>
      {offerings.map((o, index) => {
        const sectionViz = normalizeGradeVizDistribution(o.distribution);
        const isLast = index === offerings.length - 1;
        return (
          <Paper
            key={o.id}
            radius="var(--app-radius)"
            style={{
              backgroundColor: "var(--app-bg)",
              borderBottom: isLast ? undefined : "var(--app-border-width) solid var(--app-border)",
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
                    <Text size="sm" fw={600} c="var(--app-text)">
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
                  <Text size="sm" fw={600} c="var(--app-text)">
                    {formatTermLabel(o.termId)}
                  </Text>
                  {o.section ? (
                    <Text size="xs" c="dimmed">
                      {tr("explore.section", { section: o.section })}
                    </Text>
                  ) : null}
                  {o.predicted ? (
                    <HoverCard
                      width={260}
                      shadow="md"
                      radius="var(--app-radius-sm)"
                      openDelay={80}
                      withinPortal
                      position="top"
                    >
                      <HoverCard.Target>
                        <Badge
                          size="xs"
                          variant="light"
                          color="gray"
                          radius="sm"
                          style={{ textTransform: "none", cursor: "help" }}
                        >
                          {tr("explore.instructorPredictedHint")}
                        </Badge>
                      </HoverCard.Target>
                      <HoverCard.Dropdown>
                        <Text size="xs" c="dimmed">
                          {tr("explore.instructorPredictedExplain")}
                        </Text>
                      </HoverCard.Dropdown>
                    </HoverCard>
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
                {sectionViz ? (
                  <GradeDistributionHistogram
                    gradeViz={sectionViz}
                    variant="compact"
                    showStudentCount
                  />
                ) : (
                  <GradeDistributionHistogramPlaceholder />
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
}
