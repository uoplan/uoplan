import { BarChart } from "@mantine/charts";
import { computeProfessorSpread } from "@uoplan/core";
import { useMemo } from "react";
import { tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { METRIC_COLOR, formatMetricValue } from "../../lib/trends/metrics";
import type { TrendsCardContext } from "./cardContext";

const LIMIT = 14;

/** Truncate a professor name so y-axis labels stay readable. */
function shortName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}

/**
 * Per-professor mean GPA within the current scope — surfaces who grades easier
 * for a given discipline / program. Requires a scope (handled by the parent).
 */
export function ProfessorSpreadCard({
  grades,
  discipline,
  level,
  season,
  programFilter,
}: TrendsCardContext) {
  const data = useMemo(() => {
    const rows = computeProfessorSpread(
      grades,
      { discipline, level, season, programFilter },
      { limit: LIMIT },
    );
    return rows
      .filter((row): row is typeof row & { gpa: number } => row.gpa != null)
      .sort((a, b) => b.gpa - a.gpa)
      .map((row) => ({ name: shortName(row.name), value: row.gpa }));
  }, [grades, discipline, level, season, programFilter]);

  return (
    <ChartCard
      title={tr("trends.chart.profSpread.title")}
      description={tr("trends.chart.profSpread.desc")}
      empty={data.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <BarChart
        h={Math.max(220, data.length * 26 + 40)}
        data={data}
        dataKey="name"
        orientation="vertical"
        series={[{ name: "value", label: tr("trends.metric.gpa"), color: METRIC_COLOR.gpa }]}
        xAxisProps={{ domain: [0, 10] }}
        yAxisProps={{ width: 130 }}
        valueFormatter={(value) => formatMetricValue("gpa", value)}
        withLegend={false}
      />
    </ChartCard>
  );
}
