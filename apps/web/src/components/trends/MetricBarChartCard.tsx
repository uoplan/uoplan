import { BarChart } from "@mantine/charts";
import { useMemo } from "react";
import { tr, useTr } from "../../i18n";
import {
  METRIC_COLOR,
  formatMetricValue,
  metricDomain,
  pickMetric,
} from "../../lib/trends/metrics";
import { ChartCard } from "./ChartCard";
import type { TrendsCardContext } from "./cardContext";

type MetricRow = Parameters<typeof pickMetric>[0];
type MetricBarDatum<TAxisKey extends string> = Record<TAxisKey, string> & { value: number };

type MetricBarChartCardProps<
  TRow extends MetricRow,
  TAxisKey extends string,
> = TrendsCardContext & {
  title: string;
  description: string;
  axisKey: TAxisKey;
  buildRows: (context: TrendsCardContext) => TRow[];
  getAxisValue: (row: TRow) => string;
};

export function MetricBarChartCard<TRow extends MetricRow, TAxisKey extends string>({
  title,
  description,
  axisKey,
  buildRows,
  getAxisValue,
  grades,
  discipline,
  level,
  season,
  programFilter,
  metric,
  metricLabel,
}: MetricBarChartCardProps<TRow, TAxisKey>) {
  useTr();

  const data = useMemo(() => {
    const context = { grades, discipline, level, season, programFilter, metric, metricLabel };
    const rows: MetricBarDatum<TAxisKey>[] = [];
    for (const row of buildRows(context)) {
      const value = pickMetric(row, metric);
      if (value != null) {
        rows.push({ [axisKey]: getAxisValue(row), value } as MetricBarDatum<TAxisKey>);
      }
    }
    return rows;
  }, [
    axisKey,
    buildRows,
    getAxisValue,
    grades,
    discipline,
    level,
    season,
    programFilter,
    metric,
    metricLabel,
  ]);

  const [min, max] = metricDomain(metric);

  return (
    <ChartCard
      title={title}
      description={description}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <BarChart
        h={240}
        data={data}
        dataKey={axisKey}
        series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[metric] }]}
        yAxisProps={{ domain: [min, max] }}
        valueFormatter={(value) => formatMetricValue(metric, value)}
        withLegend={false}
      />
    </ChartCard>
  );
}
