import { Link } from "@tanstack/react-router";
import { Box, Group, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import type { ProfessorRatingsMap } from "schedule";
import { normalizeProfessorName, normalizeGradeVizDistribution } from "schedule";
import {
  GradeDistributionHistogram,
  GradeDistributionPassingSummary,
} from "../calendar/GradeDistributionViz";
import { tr } from "../../i18n";
import {
  mergeGradeDistributionCounts,
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
export const EXPLORE_CHEVRON_GUTTER_PX = 40;

/** Padding right for accordion - responsive with chevron gutter. */
export const EXPLORE_ACCORDION_PAD_RIGHT = {
  base: `calc(16px + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
  xs: `calc(max(24px, calc((100vw - min(100vw, 1200px)) / 2 + 24px)) + ${EXPLORE_CHEVRON_GUTTER_PX}px)`,
};

/** Compact explore histogram width (accordion + professor rows). */
export const EXPLORE_HISTOGRAM_WIDTH_PX = 240;

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

export type ExploreProfessorSummaryBarProps = {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  showProfileLink?: boolean;
  profileLinkStopPropagation?: boolean;
};

export function ExploreProfessorSummaryBar({
  group,
  professorRatings,
  showProfileLink = true,
  profileLinkStopPropagation = false,
}: ExploreProfessorSummaryBarProps) {
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
        <Group gap="xs" align="center" wrap="wrap">
          <Text fw={600} c="gray.1" lineClamp={2}>
            {group.displayName}
          </Text>
          {showProfileLink && group.legacyId != null ? (
            <Link
              to="/explore/professor/$legacyId"
              params={{ legacyId: String(group.legacyId) }}
              onClick={profileLinkStopPropagation ? (e) => e.stopPropagation() : undefined}
              style={{
                fontSize: "var(--mantine-font-size-xs)",
                color: "var(--mantine-color-violet-4)",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {tr("explore.profileLink")}
            </Link>
          ) : null}
        </Group>
        {ratingLine}
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

export type ExploreProfessorOfferingRowsProps = {
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
