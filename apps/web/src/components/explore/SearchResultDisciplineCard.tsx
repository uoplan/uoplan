import { Link } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import type { Discipline, GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { EXPLORE_RESULT_CARD_STYLE } from "./exploreResultCardShared";
import { SearchResultCardBody } from "./SearchResultCardBody";

type Props = {
  discipline: Discipline;
  courseCount: number;
  gradeViz?: GradeVizData | null;
  sentiment?: number | null;
  searchParams: ExploreSearchParams;
};

export function SearchResultDisciplineCard({
  discipline,
  courseCount,
  gradeViz,
  sentiment,
  searchParams,
}: Props) {
  const { i18n } = useLingui();
  const isFr = i18n.locale.startsWith("fr");
  const displayName = isFr ? (discipline.nameFr ?? discipline.name) : discipline.name;

  return (
    <Link
      to="/explore/discipline/$discipline"
      params={{ discipline: discipline.code.toLowerCase() }}
      search={searchParams}
      className="soft-lift"
      style={EXPLORE_RESULT_CARD_STYLE}
    >
      <SearchResultCardBody
        title={discipline.code}
        subtitle={displayName}
        sentiment={sentiment}
        footer={tr("explore.disciplineCourseCount", { count: courseCount })}
        gradeViz={gradeViz}
      />
    </Link>
  );
}
