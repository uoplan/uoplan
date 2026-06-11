import { computeSeasonComparison } from "@uoplan/core";
import type { TermSeason } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { SEASON_COLOR } from "../../lib/trends/palette";
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

type SeasonRow = ReturnType<typeof buildSeasonRows>[number];

function getSeasonLabel(row: SeasonRow): string {
  return tr(SEASON_KEY[row.season]);
}

function getSeasonColor(row: SeasonRow): string {
  return SEASON_COLOR[row.season];
}

/**
 * Compares the active metric across academic seasons for the current scope —
 * "when is this easiest?". Always compares all seasons (ignores season filter).
 * Each season bar is tinted with its semantic colour (Fall amber, Winter icy
 * blue, Spring/Summer green).
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
      getColor={getSeasonColor}
      {...props}
    />
  );
}
