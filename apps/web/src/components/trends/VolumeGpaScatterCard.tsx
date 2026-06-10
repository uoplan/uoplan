import { ScatterChart } from "@mantine/charts";
import { Paper, Text } from "@mantine/core";
import { computeCourseScatter } from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { formatMetricValue } from "../../lib/trends/metrics";
import { colorForIndex } from "../../lib/trends/palette";
import type { TrendsCardContext } from "./cardContext";

interface ScatterDatum {
  volume: number;
  gpa: number;
  code: string;
}

function ScatterTooltip({ payload }: { payload?: ReadonlyArray<{ payload?: ScatterDatum }> }) {
  const point = payload?.[0]?.payload;
  if (!point) return null;
  return (
    <Paper px="sm" py={6} withBorder shadow="sm" radius="md">
      <Text size="sm" fw={600} c="var(--app-text)">
        {point.code}
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
 * Popularity (counted graded mass) vs mean GPA, one point per course — helps
 * spot high-enrollment, high-GPA electives. Requires a discipline / program
 * scope (enforced by the parent) to stay legible.
 */
export function VolumeGpaScatterCard({
  grades,
  discipline,
  level,
  season,
  programFilter,
}: TrendsCardContext) {
  const series = useMemo(() => {
    return computeCourseScatter(grades, { discipline, level, season, programFilter })
      .filter((point): point is typeof point & { gpa: number } => point.gpa != null)
      .map((point, index) => ({
        color: colorForIndex(index),
        name: point.code,
        data: [{ volume: point.volume, gpa: point.gpa, code: point.code }] as unknown as Record<
          string,
          number
        >[],
      }));
  }, [grades, discipline, level, season, programFilter]);

  return (
    <ChartCard
      title={tr("trends.chart.scatter.title")}
      description={tr("trends.chart.scatter.desc")}
      empty={series.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <ScatterChart
        h={300}
        data={series}
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
