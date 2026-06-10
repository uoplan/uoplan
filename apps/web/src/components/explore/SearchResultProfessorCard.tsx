import { Link } from "@tanstack/react-router";
import { Box, Group, Stack, Text } from "@mantine/core";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName, hasProfessorRatings } from "@uoplan/core";
import { useTr, tr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import type { ExploreProfessorSearchEntry } from "../../lib/explore/gradesSearch";
import { professorRouteParam } from "../../lib/explore/professorRoute";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import {
  EXPLORE_RESULT_CARD_STYLE,
  exploreCardBackState,
  mostCommonGrade,
} from "./exploreResultCardShared";

function professorLegacyParam(entry: ExploreProfessorSearchEntry): string {
  return professorRouteParam({
    slug: entry.slug,
    legacyId: entry.legacyId,
    displayName: entry.displayName,
  });
}

export function SearchResultProfessorCard({
  entry,
  professorRatings,
  sentiment,
  query,
  searchParams,
}: {
  entry: ExploreProfessorSearchEntry;
  professorRatings: ProfessorRatingsMap | null;
  sentiment?: number | null;
  query?: string;
  searchParams: ExploreSearchParams;
}) {
  useTr();
  const { gradeViz } = entry;
  const grade = gradeViz ? mostCommonGrade(gradeViz) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  const rmpEntry = professorRatings
    ? professorRatings[normalizeProfessorName(entry.displayName)]
    : null;
  const hasRating = hasProfessorRatings(rmpEntry);
  const isOnRmp = entry.legacyId != null && Number.isFinite(entry.legacyId) && entry.legacyId > 0;
  const showRmp = hasRating || isOnRmp;
  const showSatisfaction = sentiment != null && sentiment > 0;
  const rmpLegacyId = entry.legacyId ?? rmpEntry?.legacyId ?? null;

  return (
    <Link
      to="/explore/professor/$slug"
      params={{ slug: professorLegacyParam(entry) }}
      search={searchParams}
      state={exploreCardBackState(searchParams, query) as never}
      className="soft-lift"
      style={EXPLORE_RESULT_CARD_STYLE}
    >
      <Stack gap={5} p={12} style={{ flex: 1 }}>
        <Text size="sm" fw={700} c="var(--app-text)" lh={1.3} style={{ wordBreak: "break-word" }}>
          {entry.displayName}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3}>
          {tr("explore.professorCourseCount", {
            count: entry.uniqueCourseCount,
          })}
        </Text>
        <Box style={{ flex: 1 }} />
        {showSatisfaction || showRmp ? (
          <Group gap={6} wrap="nowrap" align="center" component="span">
            {showSatisfaction ? (
              <RatingBadge kind="satisfaction" value={sentiment ?? null} />
            ) : null}
            {showSatisfaction && showRmp ? (
              <Text component="span" size="xs" c="dimmed">
                ·
              </Text>
            ) : null}
            {showRmp ? (
              <RatingBadge
                kind="rmp"
                value={hasRating && rmpEntry ? rmpEntry.rating : null}
                count={hasRating && rmpEntry ? rmpEntry.numRatings : null}
                legacyId={rmpLegacyId}
              />
            ) : null}
          </Group>
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
        ) : null}
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
