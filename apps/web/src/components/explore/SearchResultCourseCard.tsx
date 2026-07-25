import { Link } from "@tanstack/react-router";
import { Badge, Box, Group, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { tr, useTr } from "../../i18n";
import { useSchoolFeature } from "../../hooks/useSchool";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { EXPLORE_RESULT_CARD_STYLE } from "./exploreResultCardShared";
import {
  SearchResultCardBody,
  SearchResultCardSpacer,
  SearchResultGradeSummary,
} from "./SearchResultCardParts";

const COURSE_CARD_LINK_STYLE: CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  color: "inherit",
  textDecoration: "none",
};

const COURSE_DELIVERY_BADGE_STYLE: CSSProperties = {
  backgroundColor: "var(--app-info-soft)",
  borderRadius: "var(--app-radius-pill)",
  color: "var(--app-info)",
  flexShrink: 0,
  textTransform: "none",
};

export function SearchResultCourseCard({
  entry,
  sentiment,
  searchParams,
  virtual,
}: {
  entry: ExploreCourseSearchEntry;
  sentiment?: number | null;
  searchParams: ExploreSearchParams;
  virtual: boolean;
}) {
  useTr();
  const hasGrades = useSchoolFeature("grades");
  const { gradeViz } = entry;

  return (
    <Box className="soft-lift" style={EXPLORE_RESULT_CARD_STYLE}>
      <Link
        to="/explore/course/$course"
        params={{ course: courseNormToPathParam(entry.normCode) }}
        search={searchParams}
        style={COURSE_CARD_LINK_STYLE}
      >
        <SearchResultCardBody>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={700} c="var(--app-text)" lh={1.3} style={{ whiteSpace: "nowrap" }}>
              {entry.courseCode}
            </Text>
            {virtual ? (
              <Badge size="xs" radius="xl" variant="light" style={COURSE_DELIVERY_BADGE_STYLE}>
                {tr("explore.badge.virtual")}
              </Badge>
            ) : null}
          </Group>
          {entry.courseTitle ? (
            <Text
              size="xs"
              c="dimmed"
              lh={1.4}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {entry.courseTitle}
            </Text>
          ) : null}
          <SearchResultCardSpacer />
          {sentiment != null && sentiment > 0 ? (
            <RatingBadge kind="satisfaction" value={sentiment} />
          ) : null}
          <SearchResultGradeSummary
            gradeViz={gradeViz}
            fallback={
              // Schools without registrar grade data (e.g. Carleton) would show
              // "No grade data" on every single card, which is noise rather than
              // information — omit the line entirely there.
              hasGrades ? (
                <Text size="xs" c="dimmed" lh={1.3}>
                  {tr("search.noGradeData")}
                </Text>
              ) : null
            }
          />
        </SearchResultCardBody>
        <GradeDistributionBottomBar gradeViz={gradeViz} />
      </Link>
    </Box>
  );
}
