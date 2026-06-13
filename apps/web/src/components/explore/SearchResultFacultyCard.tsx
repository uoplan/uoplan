import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { Faculty, GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import { localizeFacultyName } from "../../lib/explore/faculty";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import { EXPLORE_RESULT_CARD_STYLE } from "./exploreResultCardShared";

type Props = {
  faculty: Faculty;
  disciplineCount: number;
  courseCount: number;
  gradeViz?: GradeVizData | null;
  sentiment?: number | null;
  searchParams: ExploreSearchParams;
};

export function SearchResultFacultyCard({
  faculty,
  disciplineCount,
  courseCount,
  gradeViz,
  sentiment,
  searchParams,
}: Props) {
  const { i18n } = useLingui();
  const displayName = localizeFacultyName(faculty, i18n.locale);

  return (
    <Link
      to="/explore/faculty/$faculty"
      params={{ faculty: faculty.id }}
      search={searchParams}
      className="soft-lift"
      style={EXPLORE_RESULT_CARD_STYLE}
    >
      <Stack gap={5} p={12} style={{ flex: 1 }}>
        <Text
          size="sm"
          fw={700}
          c="var(--app-text)"
          lh={1.3}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {displayName}
        </Text>
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={sentiment} />
        ) : null}
        <Text size="xs" c="dimmed" lh={1.3}>
          {tr("explore.facultyDisciplineCount", { count: disciplineCount })}
          {" · "}
          {tr("explore.disciplineCourseCount", { count: courseCount })}
        </Text>
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
