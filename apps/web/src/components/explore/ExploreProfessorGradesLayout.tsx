import { Link } from "@tanstack/react-router";
import {
  Accordion,
  Badge,
  Box,
  Group,
  HoverCard,
  Paper,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { CanonicalProfessorName, GradeVizData, ProfessorRatingsMap } from "@uoplan/core";
import {
  hasProfessorRatings,
  normalizeGradeVizDistribution,
  normalizeProfessorName,
} from "@uoplan/core";
import {
  GradeDistributionHistogram,
  GradeDistributionHistogramPlaceholder,
  GradeDistributionPassingSummary,
} from "../calendar/GradeDistributionViz";
import { tr, useTr } from "../../i18n";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { formatTermLabel } from "../../lib/term/termLabel";
import { mergeGradeDistributionCounts } from "../../lib/explore/gradesSearch";
import type {
  CourseOfferingGroup,
  ExploreOfferingFlat,
  ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { professorRouteParam } from "../../lib/explore/professorRoute";
import { useAppStore } from "../../store/appStore";
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

function ExploreSummaryWithGradeViz({
  children,
  gradeViz,
}: {
  children: ReactNode;
  gradeViz: GradeVizData | null;
}) {
  return (
    <>
      <Stack gap={4} style={{ minWidth: 0, flex: "1 1 auto" }}>
        {children}
        {gradeViz ? <GradeDistributionPassingSummary gradeViz={gradeViz} compact /> : null}
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
        {gradeViz ? (
          <GradeDistributionHistogram gradeViz={gradeViz} variant="compact" showStudentCount />
        ) : (
          <GradeDistributionHistogramPlaceholder />
        )}
      </Box>
    </>
  );
}

function professorRatingLine(
  displayName: CanonicalProfessorName,
  professorRatings: ProfessorRatingsMap | null,
) {
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
  /** All-terms offerings for the histogram when the rows are term-filtered (defaults to group.offerings). */
  aggregateOfferings?: ExploreOfferingFlat[];
  /** Search params carried into the professor link so active filters persist (defaults to none). */
  linkSearch?: ExploreSearchParams;
};

export function ExploreProfessorSummaryBar({
  group,
  professorRatings,
  stopPropagation = false,
  aggregateOfferings,
  linkSearch,
}: ExploreProfessorSummaryBarProps) {
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(
          (aggregateOfferings ?? group.offerings).map((o) => o.distribution),
        ),
      ),
    [aggregateOfferings, group.offerings],
  );

  const professorRatingsLoading = useAppStore((s) => s.professorRatingsLoading);

  let ratingLine: ReactNode = null;
  if (!group.unassigned) {
    if (professorRatings) {
      ratingLine = professorRatingLine(group.displayName, professorRatings);
    } else if (professorRatingsLoading) {
      ratingLine = <Skeleton height={12} width={90} radius="sm" aria-hidden />;
    }
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
      <ExploreSummaryWithGradeViz gradeViz={combinedViz}>
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
            to="/explore/professor/$slug"
            params={{
              slug: professorRouteParam({
                slug: group.slug,
                legacyId: group.legacyId,
                displayName: group.displayName,
              }),
            }}
            search={linkSearch ?? EMPTY_EXPLORE_SEARCH}
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
      </ExploreSummaryWithGradeViz>
    </Box>
  );
}

type ExploreCourseSummaryBarProps = {
  group: CourseOfferingGroup;
  /** All-terms offerings for the histogram when the rows are term-filtered (defaults to group.offerings). */
  aggregateOfferings?: ExploreOfferingFlat[];
  /** Search params carried into the course link so active filters persist (defaults to none). */
  linkSearch?: ExploreSearchParams;
};

export function ExploreCourseSummaryBar({
  group,
  aggregateOfferings,
  linkSearch,
}: ExploreCourseSummaryBarProps) {
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(
          (aggregateOfferings ?? group.offerings).map((o) => o.distribution),
        ),
      ),
    [aggregateOfferings, group.offerings],
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
      <ExploreSummaryWithGradeViz gradeViz={combinedViz}>
        <Link
          to="/explore/course/$course"
          params={{ course: courseNormToPathParam(group.groupId) }}
          search={linkSearch ?? EMPTY_EXPLORE_SEARCH}
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
      </ExploreSummaryWithGradeViz>
    </Box>
  );
}

type ExploreCourseItemProps = {
  group: CourseOfferingGroup;
  aggregateOfferings?: ExploreOfferingFlat[];
  linkSearch?: ExploreSearchParams;
};

export function ExploreCourseItem({
  group,
  aggregateOfferings,
  linkSearch,
}: ExploreCourseItemProps) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreCourseSummaryBar
          group={group}
          aggregateOfferings={aggregateOfferings}
          linkSearch={linkSearch}
        />
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
