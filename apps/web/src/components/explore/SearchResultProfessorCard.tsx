import { Link } from "@tanstack/react-router";
import { Text } from "@mantine/core";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { ProfessorRatingBadges } from "../shared/RatingBadge";
import type { ExploreProfessorSearchEntry } from "../../lib/explore/gradesSearch";
import { professorRouteParam } from "../../lib/explore/professorRoute";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { EXPLORE_RESULT_CARD_STYLE } from "./exploreResultCardShared";
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
  searchParams,
}: {
  entry: ExploreProfessorSearchEntry;
  professorRatings: ProfessorRatingsMap | null;
  sentiment?: number | null;
  searchParams: ExploreSearchParams;
}) {
  useTr();
  const { gradeViz } = entry;

  return (
    <Link
      to="/explore/professor/$slug"
      params={{ slug: professorLegacyParam(entry) }}
      search={searchParams}
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
        <ProfessorRatingBadges
          displayName={entry.displayName}
          professorRatings={professorRatings}
          legacyId={entry.legacyId}
          sentiment={sentiment}
        />
        <SearchResultGradeSummary gradeViz={gradeViz} />
      </SearchResultCardBody>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
