import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import type { GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { programSlugToPathParam } from "../../lib/explore/programSearch";
import type { ExploreProgramSearchEntry } from "../../lib/explore/programSearch";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import { EXPLORE_RESULT_CARD_STYLE } from "./exploreResultCardShared";

type Props = {
  program: ExploreProgramSearchEntry;
  gradeViz?: GradeVizData | null;
  sentiment?: number | null;
};

export function SearchResultProgramCard({ program, gradeViz, sentiment }: Props) {
  return (
    <Link
      to="/explore/program/$"
      params={{ _splat: programSlugToPathParam(program.slug) }}
      search={EMPTY_EXPLORE_SEARCH}
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
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {program.title}
        </Text>
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={sentiment} />
        ) : null}
        {program.courseCount > 0 ? (
          <Text size="xs" c="dimmed" lh={1.3}>
            {tr("explore.program.courseCount", { count: program.courseCount })}
          </Text>
        ) : null}
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
