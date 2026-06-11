import { ScatterChart } from "@mantine/charts";
import { Paper, Text } from "@mantine/core";
import { computeDisciplineComparison, disciplineSentiment } from "@uoplan/core";
import { useMemo } from "react";
import { tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { formatMetricValue } from "../../lib/trends/metrics";
import { colorForIndex } from "../../lib/trends/palette";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import type { TrendsCardContext } from "./cardContext";

interface DisciplineScatterDatum {
  satisfaction: number;
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
        {tr("trends.chart.disciplineScatter.tooltip", {
          gpa: formatMetricValue("gpa", point.gpa),
          satisfaction: point.satisfaction.toFixed(2),
        })}
      </Text>
    </Paper>
  );
}

/**
 * Average course-feedback satisfaction vs mean GPA, one point per discipline.
 * Cross-discipline by design (ignores the discipline filter); honors level /
 * season filters.
 */
export function DisciplineScatterCard({ grades, level, season }: TrendsCardContext) {
  const { data: feedback, loading: feedbackLoading } = useFeedbackData();
  const series = useMemo(() => {
    if (!feedback) return [];
    const satisfactionByDiscipline = disciplineSentiment(feedback, { level, season });
    return computeDisciplineComparison(grades, { level, season })
      .flatMap((row) => {
        const satisfaction = satisfactionByDiscipline.get(row.discipline);
        if (row.gpa == null || satisfaction == null) return [];
        return [{ satisfaction, gpa: row.gpa, discipline: row.discipline }];
      })
      .map((point, index) => ({
        color: colorForIndex(index),
        name: point.discipline,
        data: [point] as unknown as Record<string, number>[],
      }));
  }, [feedback, grades, level, season]);

  return (
    <ChartCard
      title={tr("trends.chart.disciplineScatter.title")}
      description={tr("trends.chart.disciplineScatter.desc")}
      empty={feedbackLoading || !feedback || series.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <ScatterChart
        h={300}
        data={series}
        dataKey={{ x: "satisfaction", y: "gpa" }}
        xAxisLabel={tr("trends.chart.scatter.axisSatisfaction")}
        yAxisLabel={tr("trends.chart.scatter.axisGpa")}
        xAxisProps={{ domain: [1, 5] }}
        yAxisProps={{ domain: [0, 10] }}
        valueFormatter={{
          x: (value) => value.toFixed(2),
          y: (value) => formatMetricValue("gpa", value),
        }}
        tooltipProps={{ content: ({ payload }) => <ScatterTooltip payload={payload} /> }}
        withLegend={false}
      />
    </ChartCard>
  );
}
