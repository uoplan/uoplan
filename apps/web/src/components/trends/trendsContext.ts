import { createContext, useContext } from "react";
import type { CourseGradesData, ProgramCourseFilter, TermSeason, TrendPoint } from "@uoplan/core";
import type { createRankedOptionsFilter } from "../../lib/explore/optionRanking";
import type { TrendsMetric, TrendsSearch } from "../../lib/trends/searchParams";
import type { BackState } from "../../lib/navigation/backState";
import type { TrendsCardContext } from "./cardContext";

export type SelectOption = { value: string; label: string };

export interface TrendsContextValue {
  /** Raw grades dataset (null until loaded). */
  grades: CourseGradesData | null;
  gradesError: string | null;
  /** True once grades + named disciplines are available to render charts. */
  ready: boolean;
  isMobile: boolean;
  isFr: boolean;

  search: TrendsSearch;
  update: (patch: Partial<TrendsSearch>) => void;

  discipline: string | null;
  level: number | null;
  season: TermSeason | null;
  programSlugValue: string | null;
  programFilter: ProgramCourseFilter | null;

  activeMetric: TrendsMetric;
  metricLabel: string;
  metricOptions: { value: TrendsMetric; label: string }[];

  disciplineOptions: SelectOption[];
  programOptions: SelectOption[];
  disciplineOptionsFilter: ReturnType<typeof createRankedOptionsFilter>;
  disciplineNameByCode: Map<string, string>;
  levelData: SelectOption[];
  seasonData: SelectOption[];

  points: TrendPoint[];
  cardContext: TrendsCardContext | null;
  filteredMode: boolean;

  scopeSummary: string;
  activeFilterCount: number;
  trendsBack: BackState;

  formatMetric: (metric: TrendsMetric, value: number | null) => string;
}

export const TrendsContext = createContext<TrendsContextValue | null>(null);

export function useTrends(): TrendsContextValue {
  const ctx = useContext(TrendsContext);
  if (!ctx) throw new Error("useTrends must be used within a TrendsFilterProvider");
  return ctx;
}
