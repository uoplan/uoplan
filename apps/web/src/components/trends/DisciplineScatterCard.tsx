import { ScatterChart } from "@mantine/charts";
import { Paper, Text } from "@mantine/core";
import { computeDisciplineComparison } from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { METRIC_COLOR, formatMetricValue } from "../../lib/trends/metrics";
import type { TrendsCardContext } from "./cardContext";

interface DisciplineScatterDatum {
  volume: number;
  gpa: number;
  discipline: string;
}

function ScatterTooltip({
  payload,
}: {
  payload?: ReadonlyArray<{ payload?: DisciplineScatterDatum }>;
}) {
  const point = payload?.[0]?.payload;
  if (!point) return null;
  return (
    <Paper px="sm" py={6} withBorder shadow="sm" radius="md">
      <Text size="sm" fw={600} c="var(--app-text)">
        {point.discipline}
      </Text>
      <Text size="xs" c="dimmed">
        {tr("trends.chart.scatter.tooltip", {
          gpa: formatMetricValue("gpa", point.gpa),
          volume: formatLocaleNumber(point.volume),
        })}
      </Text>
    </Paper>
  );
}

/**
 * Popularity (counted graded mass) vs mean GPA, one point per discipline — spots
 * the high-enrollment, high-GPA disciplines. Cross-discipline by design (ignores
 * the discipline filter); honors level / season.
 */
export function DisciplineScatterCard({ grades, level, season }: TrendsCardContext) {
  const points = useMemo(() => {
    return computeDisciplineComparison(grades, { level, season })
      .filter((row): row is typeof row & { gpa: number } => row.gpa != null)
      .map((row) => ({ volume: row.volume, gpa: row.gpa, discipline: row.discipline }));
  }, [grades, level, season]);

  return (
    <ChartCard
      title={tr("trends.chart.disciplineScatter.title")}
      description={tr("trends.chart.disciplineScatter.desc")}
      empty={points.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <ScatterChart
        h={300}
        data={[
          {
            color: METRIC_COLOR.gpa,
            name: tr("trends.chart.disciplineScatter.series"),
            data: points as unknown as Record<string, number>[],
          },
        ]}
        dataKey={{ x: "volume", y: "gpa" }}
        xAxisLabel={tr("trends.chart.scatter.axisVolume")}
        yAxisLabel={tr("trends.chart.scatter.axisGpa")}
        yAxisProps={{ domain: [0, 10] }}
        valueFormatter={{
          x: (value) => formatLocaleNumber(value),
          y: (value) => formatMetricValue("gpa", value),
        }}
        tooltipProps={{ content: ({ payload }) => <ScatterTooltip payload={payload} /> }}
        withLegend={false}
      />
    </ChartCard>
  );
}
