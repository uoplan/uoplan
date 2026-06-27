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
import type { GradeVizData, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeGradeVizDistribution } from "@uoplan/core";
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
import { ProfessorRatingBadges } from "../shared/RatingBadge";
import { WhyNotPredictedHoverDetails } from "./WhyNotPredictedHoverDetails";
import { useLazyData } from "../../store/hooks";
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

type ExploreProfessorSummaryBarProps = {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  stopPropagation?: boolean;
  /** Search params carried into the professor link so active filters persist (defaults to none). */
  linkSearch?: ExploreSearchParams;
  /** Overall course-feedback satisfaction (1-5) for this professor, when available. */
  sentiment?: number | null;
};

export function ExploreProfessorSummaryBar({
  group,
  professorRatings,
  stopPropagation = false,
  linkSearch,
  sentiment,
}: ExploreProfessorSummaryBarProps) {
  const combinedViz = useMemo(
    () =>
      normalizeGradeVizDistribution(
        mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution)),
      ),
    [group.offerings],
  );

  const { professorRatingsLoading } = useLazyData();

  // ⭐ RateMyProf + 💬 satisfaction badges — the same row the search-result cards use.
  let ratingBadges: ReactNode = null;
  if (!group.unassigned) {
    ratingBadges =
      !professorRatings && professorRatingsLoading ? (
        <Skeleton height={18} width={58} radius="sm" aria-hidden />
      ) : (
        <ProfessorRatingBadges
          displayName={group.displayName}
          professorRatings={professorRatings}
          legacyId={group.legacyId}
          sentiment={sentiment}
        />
      );
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
            params={{ slug: group.slug }}
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
        {ratingBadges}
      </ExploreSummaryWithGradeViz>
    </Box>
  );
}

type ExploreCourseSummaryBarProps = {
  group: CourseOfferingGroup;
  /** Search params carried into the course link so active filters persist (defaults to none). */
  linkSearch?: ExploreSearchParams;
  /**
   * Render the course code as plain text instead of a link. Use when an ancestor
   * (e.g. a whole-row link) already navigates to the course page, to avoid
   * nesting anchors.
   */
  asPlainCode?: boolean;
};

export function ExploreCourseSummaryBar({
  group,
  linkSearch,
  asPlainCode = false,
}: ExploreCourseSummaryBarProps) {
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
      <ExploreSummaryWithGradeViz gradeViz={combinedViz}>
        {asPlainCode ? (
          <Text fw={600} c="var(--app-text)" style={{ alignSelf: "flex-start" }}>
            {group.courseCode}
          </Text>
        ) : (
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
        )}
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
  linkSearch?: ExploreSearchParams;
};

export function ExploreCourseItem({ group, linkSearch }: ExploreCourseItemProps) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreCourseSummaryBar group={group} linkSearch={linkSearch} />
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
                      width={300}
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
                      <HoverCard.Dropdown p="xs">
                        <Text size="xs" c="dimmed">
                          {tr("explore.instructorPredictedExplain")}
                        </Text>
                        {o.predictedInstructors?.length ? (
                          <WhyNotPredictedHoverDetails
                            courseCode={o.courseCode}
                            termId={o.termId}
                          />
                        ) : null}
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
