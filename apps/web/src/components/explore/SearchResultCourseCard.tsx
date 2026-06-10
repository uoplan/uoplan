import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import { useTr, tr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import {
  EXPLORE_RESULT_CARD_STYLE,
  exploreCardBackState,
  mostCommonGrade,
} from "./exploreResultCardShared";

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
  const grade = gradeViz ? mostCommonGrade(gradeViz) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  return (
    <Link
      to="/explore/course/$course"
      params={{ course: courseNormToPathParam(entry.normCode) }}
      search={searchParams}
      state={exploreCardBackState(searchParams, query) as never}
      className="soft-lift"
      style={EXPLORE_RESULT_CARD_STYLE}
    >
      <Stack gap={5} p={12} style={{ flex: 1 }}>
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
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={sentiment} />
        ) : null}
        {gradeViz ? (
          <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
            {grade ? (
              <>
                <Text component="span" fw={600} c="var(--app-text)">
                  {grade}
                </Text>{" "}
                ·{" "}
              </>
            ) : null}
            {passing !== null ? tr("search.passingPercent", { percent: passing }) : null}
          </Text>
        ) : (
          <Text size="xs" c="dimmed" lh={1.3}>
            {tr("search.noGradeData")}
          </Text>
        )}
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
