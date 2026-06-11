import { Link } from "@tanstack/react-router";
import { Group, Text } from "@mantine/core";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { hasProfessorRatings, normalizeProfessorName } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";
import type { ExploreProfessorSearchEntry } from "../../lib/explore/gradesSearch";
import { professorRouteParam } from "../../lib/explore/professorRoute";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { EXPLORE_RESULT_CARD_STYLE, exploreCardBackState } from "./exploreResultCardShared";
import {
  SearchResultCardBody,
  SearchResultCardSpacer,
  SearchResultGradeSummary,
} from "./SearchResultCardParts";

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
      <SearchResultCardBody>
        <Text size="sm" fw={700} c="var(--app-text)" lh={1.3} style={{ wordBreak: "break-word" }}>
          {entry.displayName}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3}>
          {tr("explore.professorCourseCount", {
            count: entry.uniqueCourseCount,
          })}
        </Text>
        <SearchResultCardSpacer />
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
        <SearchResultGradeSummary gradeViz={gradeViz} />
      </SearchResultCardBody>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
