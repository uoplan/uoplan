import { BarChart } from "@mantine/charts";
import { computeDisciplineComparison } from "@uoplan/core";
import { useMemo } from "react";
import { tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import {
  formatMetricValue,
  METRIC_COLOR,
  metricDomain,
  pickMetric,
} from "../../lib/trends/metrics";
import { colorForIndex } from "../../lib/trends/palette";
import type { TrendsCardContext } from "./cardContext";

const TOP_N = 15;

/**
 * Ranked comparison of the active metric across disciplines. Cross-discipline by
 * design — ignores the page's discipline filter, honors level / season.
 */
export function DisciplineBarCard({
  grades,
  level,
  season,
  metric,
  metricLabel,
}: TrendsCardContext) {
  const data = useMemo(() => {
    const rows = computeDisciplineComparison(grades, { level, season });
    return rows
      .map((row) => ({ discipline: row.discipline, value: pickMetric(row, metric) }))
      .filter((row): row is { discipline: string; value: number } => row.value != null)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N)
      .map((row, index) => ({ ...row, color: colorForIndex(index) }));
  }, [grades, level, season, metric]);

  const [min, max] = metricDomain(metric);

  return (
    <ChartCard
      title={tr("trends.chart.disciplineBar.title")}
      description={tr("trends.chart.disciplineBar.desc")}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <BarChart
        h={Math.max(220, data.length * 26 + 40)}
        data={data}
        dataKey="discipline"
        orientation="vertical"
        series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[metric] }]}
        xAxisProps={{ domain: [min, max] }}
        yAxisProps={{ width: 52 }}
        valueFormatter={(value) => formatMetricValue(metric, value)}
        withLegend={false}
      />
    </ChartCard>
  );
}
