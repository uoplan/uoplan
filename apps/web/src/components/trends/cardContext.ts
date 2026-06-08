import type { CourseGradesData, ProgramCourseFilter, TermSeason } from "@uoplan/core";
import type { TrendsMetric } from "../../lib/trends/searchParams";

/** Resolved filter context shared by the trends chart cards. */
export interface TrendsCardContext {
  grades: CourseGradesData;
  discipline: string | null;
  level: number | null;
  season: TermSeason | null;
  programFilter: ProgramCourseFilter | null;
  metric: TrendsMetric;
  metricLabel: string;
}
