import { computeSeasonComparison, type TermSeason } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import type { TrendsCardContext } from "./cardContext";
import { MetricBarChartCard } from "./MetricBarChartCard";

const SEASON_KEY: Record<TermSeason, string> = {
  fall: "trends.season.fall",
  winter: "trends.season.winter",
  springSummer: "trends.season.springSummer",
};

function buildSeasonRows({ grades, discipline, level, programFilter }: TrendsCardContext) {
  return computeSeasonComparison(grades, { discipline, level, programFilter });
}

function getSeasonLabel(row: ReturnType<typeof buildSeasonRows>[number]): string {
  return tr(SEASON_KEY[row.season]);
}

/**
 * Compares the active metric across academic seasons for the current scope —
 * "when is this easiest?". Always compares all seasons (ignores season filter).
 */
export function SeasonBarCard(props: TrendsCardContext) {
  useTr();

  return (
    <MetricBarChartCard
      title={tr("trends.chart.season.title")}
      description={tr("trends.chart.season.desc")}
      axisKey="season"
      buildRows={buildSeasonRows}
      getAxisValue={getSeasonLabel}
      {...props}
    />
  );
}
