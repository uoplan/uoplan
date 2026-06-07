import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { computeDisciplineYearHeatmap } from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import { formatMetricValue, toAnalyticsMetric } from "../../lib/trends/metrics";
import type { TrendsCardContext } from "./cardContext";

/** Map a value within [min,max] to a red→amber→green colour. */
function cellColor(value: number | null, min: number, max: number): string {
  if (value == null) return "var(--app-surface-muted, rgba(127,127,127,0.10))";
  const span = max - min;
  const t = span > 0 ? Math.max(0, Math.min(1, (value - min) / span)) : 0.5;
  return `hsl(${Math.round(t * 130)}, 58%, 46%)`;
}

/**
 * Discipline × year matrix of the active metric — a dense view of how every
 * discipline's grades drift over time. Cross-discipline (ignores the discipline
 * filter), honors level / season. GPA is used when "volume" is the active metric.
 */
export function DisciplineHeatmapCard({
  grades,
  level,
  season,
  metric,
  metricLabel,
}: TrendsCardContext) {
  const analyticsMetric = toAnalyticsMetric(metric) ?? "gpa";
  const cellMetric = metric === "volume" ? "gpa" : metric;

  const heatmap = useMemo(
    () => computeDisciplineYearHeatmap(grades, { level, season, metric: analyticsMetric }),
    [grades, level, season, analyticsMetric],
  );

  const [min, max] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of heatmap.rows) {
      for (const cell of row.cells) {
        if (cell.value == null) continue;
        lo = Math.min(lo, cell.value);
        hi = Math.max(hi, cell.value);
      }
    }
    return Number.isFinite(lo) ? [lo, hi] : [0, 1];
  }, [heatmap]);

  const gridTemplate = `56px repeat(${heatmap.years.length}, minmax(26px, 1fr))`;

  return (
    <ChartCard
      title={tr("trends.chart.heatmap.title")}
      description={tr("trends.chart.heatmap.descMetric", { metric: metricLabel })}
      empty={heatmap.rows.length === 0}
      emptyText={tr("trends.chart.empty")}
    >
      <Box style={{ overflowX: "auto" }}>
        <Stack gap={3} style={{ minWidth: heatmap.years.length * 30 + 56 }}>
          <Box style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 3 }}>
            <Box />
            {heatmap.years.map((year) => (
              <Text key={year} size="9px" c="dimmed" ta="center">
                {String(year).slice(2)}
              </Text>
            ))}
          </Box>
          {heatmap.rows.map((row) => (
            <Box
              key={row.discipline}
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                gap: 3,
                alignItems: "center",
              }}
            >
              <Text size="xs" fw={600} c="var(--app-text)" style={{ lineHeight: 1 }}>
                {row.discipline}
              </Text>
              {row.cells.map((cell) => (
                <Tooltip
                  key={cell.year}
                  withArrow
                  disabled={cell.value == null}
                  label={tr("trends.chart.heatmap.tooltip", {
                    discipline: row.discipline,
                    year: cell.year,
                    value: formatMetricValue(cellMetric, cell.value),
                    volume: formatLocaleNumber(cell.volume),
                  })}
                >
                  <Box
                    style={{
                      height: 20,
                      borderRadius: 3,
                      backgroundColor: cellColor(cell.value, min, max),
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          ))}
        </Stack>
      </Box>
      <Group gap={6} justify="flex-end" mt={4}>
        <Text size="9px" c="dimmed">
          {tr("trends.chart.heatmap.legendLow")}
        </Text>
        <Box
          style={{
            width: 96,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(90deg, hsl(0,58%,46%), hsl(65,58%,46%), hsl(130,58%,46%))",
          }}
        />
        <Text size="9px" c="dimmed">
          {tr("trends.chart.heatmap.legendHigh")}
        </Text>
      </Group>
    </ChartCard>
  );
}
