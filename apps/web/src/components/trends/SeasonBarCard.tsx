import { BarChart } from "@mantine/charts";
import { computeSeasonComparison, type TermSeason } from "@uoplan/core";
import { useMemo } from "react";
import { tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import {
  METRIC_COLOR,
  formatMetricValue,
  metricDomain,
  pickMetric,
} from "../../lib/trends/metrics";
import type { TrendsCardContext } from "./cardContext";

const SEASON_KEY: Record<TermSeason, string> = {
  fall: "trends.season.fall",
  winter: "trends.season.winter",
  springSummer: "trends.season.springSummer",
};

/**
 * Compares the active metric across academic seasons for the current scope —
 * "when is this easiest?". Always compares all seasons (ignores season filter).
 */
export function SeasonBarCard({
  grades,
  discipline,
  level,
  programFilter,
  metric,
  metricLabel,
}: TrendsCardContext) {
  const data = useMemo(() => {
    const rows = computeSeasonComparison(grades, { discipline, level, programFilter });
    return rows
      .map((row) => ({ season: tr(SEASON_KEY[row.season]), value: pickMetric(row, metric) }))
      .filter((row): row is { season: string; value: number } => row.value != null);
  }, [grades, discipline, level, programFilter, metric]);

  const [min, max] = metricDomain(metric);

  return (
    <ChartCard
      title={tr("trends.chart.season.title")}
      description={tr("trends.chart.season.desc")}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <BarChart
        h={240}
        data={data}
        dataKey="season"
        series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[metric] }]}
        yAxisProps={{ domain: [min, max] }}
        valueFormatter={(value) => formatMetricValue(metric, value)}
        withLegend={false}
      />
    </ChartCard>
  );
}
