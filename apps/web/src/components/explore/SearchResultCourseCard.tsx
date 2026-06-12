import { Link } from "@tanstack/react-router";
import { Box, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { tr, useTr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { EXPLORE_RESULT_CARD_STYLE, exploreCardBackState } from "./exploreResultCardShared";
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

export function SearchResultCourseCard({
  entry,
  sentiment,
  query,
  searchParams,
}: {
  entry: ExploreCourseSearchEntry;
  sentiment?: number | null;
  query?: string;
  searchParams: ExploreSearchParams;
}) {
  useTr();
  const { gradeViz } = entry;

  return (
    <Box className="soft-lift" style={EXPLORE_RESULT_CARD_STYLE}>
      <Link
        to="/explore/course/$course"
        params={{ course: courseNormToPathParam(entry.normCode) }}
        search={searchParams}
        state={exploreCardBackState(searchParams, query) as never}
        style={COURSE_CARD_LINK_STYLE}
      >
        <SearchResultCardBody>
          <Text size="sm" fw={700} c="var(--app-text)" lh={1.3}>
            {entry.courseCode}
          </Text>
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
              <Text size="xs" c="dimmed" lh={1.3}>
                {tr("search.noGradeData")}
              </Text>
            }
          />
        </SearchResultCardBody>
        <GradeDistributionBottomBar gradeViz={gradeViz} />
      </Link>
    </Box>
  );
}
