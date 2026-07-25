import { Link } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import type { Faculty, GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import { localizeFacultyName } from "../../lib/explore/faculty";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import {
  EXPLORE_RESULT_CARD_FILL_STYLE,
  EXPLORE_RESULT_CARD_STYLE,
} from "./exploreResultCardShared";
import { SearchResultCardBody } from "./SearchResultCardBody";

type Props = {
  faculty: Faculty;
  disciplineCount: number;
  courseCount: number;
  gradeViz?: GradeVizData | null;
  sentiment?: number | null;
  searchParams: ExploreSearchParams;
  /** Stretch the card to its container (grid cell) instead of the fixed row width. */
  fillWidth?: boolean;
};

export function SearchResultFacultyCard({
  faculty,
  disciplineCount,
  courseCount,
  gradeViz,
  sentiment,
  searchParams,
  fillWidth = false,
}: Props) {
  const { i18n } = useLingui();
  const displayName = localizeFacultyName(faculty, i18n.locale);

  return (
    <Link
      to="/explore/faculty/$faculty"
      params={{ faculty: faculty.id }}
      search={searchParams}
      className="soft-lift"
      style={fillWidth ? EXPLORE_RESULT_CARD_FILL_STYLE : EXPLORE_RESULT_CARD_STYLE}
    >
      <SearchResultCardBody
        title={displayName}
        clampTitle
        sentiment={sentiment}
        footer={
          <>
            {tr("explore.facultyDisciplineCount", { count: disciplineCount })}
            {" · "}
            {tr("explore.disciplineCourseCount", { count: courseCount })}
          </>
        }
        gradeViz={gradeViz}
      />
    </Link>
  );
}
