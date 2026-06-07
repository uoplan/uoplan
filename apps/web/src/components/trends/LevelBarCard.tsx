import { BarChart } from "@mantine/charts";
import { computeLevelComparison } from "@uoplan/core";
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

/**
 * Compares the active metric across course-level buckets (1000 → 9000) for the
 * current discipline scope — shows how difficulty shifts with level. Ignores the
 * page's level filter.
 */
export function LevelBarCard({
  grades,
  discipline,
  season,
  metric,
  metricLabel,
}: TrendsCardContext) {
  const data = useMemo(() => {
    const rows = computeLevelComparison(grades, { discipline, season });
    return rows
      .map((row) => ({ level: String(row.level), value: pickMetric(row, metric) }))
      .filter((row): row is { level: string; value: number } => row.value != null);
  }, [grades, discipline, season, metric]);

  const [min, max] = metricDomain(metric);

  return (
    <ChartCard
      title={tr("trends.chart.level.title")}
      description={tr("trends.chart.level.desc")}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <BarChart
        h={240}
        data={data}
        dataKey="level"
        series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[metric] }]}
        yAxisProps={{ domain: [min, max] }}
        valueFormatter={(value) => formatMetricValue(metric, value)}
        withLegend={false}
      />
    </ChartCard>
  );
}
