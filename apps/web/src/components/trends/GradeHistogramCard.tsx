import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { computeGradeHistogram } from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import { ChartCard } from "./ChartCard";
import type { TrendsCardContext } from "./cardContext";

const CHART_HEIGHT = 200;

/**
 * Aggregate letter-grade distribution for the current scope, rendered as a
 * compact coloured histogram (failing → A+). Honors the full filter set.
 */
export function GradeHistogramCard({
  grades,
  discipline,
  level,
  season,
  programFilter,
}: TrendsCardContext) {
  const histogram = useMemo(
    () => computeGradeHistogram(grades, { discipline, level, season, programFilter }),
    [grades, discipline, level, season, programFilter],
  );

  const bars = histogram?.bars ?? [];
  const maxCount = bars.reduce((max, bar) => Math.max(max, bar.count), 0);

  return (
    <ChartCard
      title={tr("trends.chart.histogram.title")}
      description={tr("trends.chart.histogram.desc")}
      empty={!histogram || maxCount <= 0}
      emptyText={tr("trends.chart.empty")}
    >
      <Stack gap={6}>
        <Group
          align="flex-end"
          gap={4}
          wrap="nowrap"
          style={{ height: CHART_HEIGHT, width: "100%" }}
        >
          {bars.map((bar) => {
            const pct = histogram ? (bar.count / histogram.total) * 100 : 0;
            const heightPct = maxCount > 0 ? (bar.count / maxCount) * 100 : 0;
            return (
              <Tooltip
                key={bar.grade}
                withArrow
                label={tr("trends.chart.histogram.tooltip", {
                  grade: bar.grade,
                  count: formatLocaleNumber(bar.count),
                  pct: formatLocaleNumber(pct, { maximumFractionDigits: 1 }),
                })}
              >
                <Box
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: `${heightPct}%`,
                    minHeight: bar.count > 0 ? 2 : 0,
                    backgroundColor: bar.color,
                    borderRadius: "var(--app-radius-sm, 3px) var(--app-radius-sm, 3px) 0 0",
                  }}
                />
              </Tooltip>
            );
          })}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ width: "100%" }}>
          {bars.map((bar) => (
            <Text
              key={bar.grade}
              size="9px"
              c="dimmed"
              ta="center"
              style={{ flex: 1, minWidth: 0 }}
            >
              {bar.grade}
            </Text>
          ))}
        </Group>
      </Stack>
    </ChartCard>
  );
}
