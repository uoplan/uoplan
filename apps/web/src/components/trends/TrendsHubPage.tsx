import { Box, Group, Skeleton, Stack, Text } from "@mantine/core";
import { BarChart, LineChart } from "@mantine/charts";
import {
  computeDisciplineComparison,
  computeDisciplineLeaderboard,
  computeSeasonComparison,
  feedbackAllViews,
  feedbackOverallSeries,
  type TermSeason,
  type TrendPoint,
} from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr, useTr } from "../../i18n";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import { formatTermLabelShort } from "../../lib/term/termLabel";
import { METRIC_COLOR, formatMetricValue, pickMetric } from "../../lib/trends/metrics";
import type { TrendsMetric } from "../../lib/trends/searchParams";
import { AppCard } from "../shared/AppCard";
import { AnimatedNumber } from "../shared/AnimatedNumber";
import { CATEGORY_PREVIEW_HEIGHT, TrendsCategoryCard } from "./TrendsCategoryCard";
import { useTrends } from "./trendsContext";

const SEASON_SHORT: Record<TermSeason, string> = {
  fall: "F",
  winter: "W",
  springSummer: "S",
};

const SEASON_KEY: Record<TermSeason, string> = {
  fall: "trends.season.fall",
  winter: "trends.season.winter",
  springSummer: "trends.season.springSummer",
};

function pointMetric(point: TrendPoint, metric: TrendsMetric): number | null {
  switch (metric) {
    case "gpa":
      return point.gpa;
    case "a-plus":
      return point.aPlusPct;
    case "a-range":
      return point.aRangePct;
    case "pass":
      return point.passPct;
    case "volume":
      return point.volume;
  }
}

/**
 * The `/trends` landing page. A bento grid: a wide Overview card (top-line stats
 * + the primary metric trend) spanning both columns, then equal-height category
 * cards with compact, hoverable previews linking to the dedicated sub-pages.
 */
export function TrendsHubPage() {
  useTr();
  const { isMobile } = useTrends();

  const spanAll = isMobile ? undefined : "1 / -1";

  return (
    <Box
      style={{
        display: "grid",
        gap: "var(--mantine-spacing-md)",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        alignItems: "stretch",
      }}
    >
      <OverviewCard style={{ gridColumn: spanAll }} />

      <TrendsCategoryCard
        to="/trends/disciplines"
        title={tr("trends.section.disciplines")}
        description={tr("trends.section.disciplinesDesc")}
        preview={<DisciplinePreview />}
      />
      <TrendsCategoryCard
        to="/trends/courses"
        title={tr("trends.section.courseChoice")}
        description={tr("trends.section.courseChoiceDesc")}
        preview={<SeasonPreview />}
      />
      <TrendsCategoryCard
        to="/trends/leaderboard"
        title={tr("trends.leaderboard.title")}
        description={tr("trends.hub.leaderboardDesc")}
        preview={<LeaderboardPreview />}
      />
      <TrendsCategoryCard
        to="/trends/feedback"
        title={tr("trends.section.feedback")}
        description={tr("trends.section.feedbackDesc")}
        preview={<FeedbackPreview />}
      />
    </Box>
  );
}

function OverviewCard({ style }: { style?: React.CSSProperties }) {
  const { points, activeMetric, metricOptions, formatMetric } = useTrends();

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        term: `${point.season ? SEASON_SHORT[point.season] : "?"}${String(point.year).slice(2)}`,
        value: pointMetric(point, activeMetric),
      })),
    [points, activeMetric],
  );

  const firstPoint = points[0] ?? null;
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const latestValue = lastPoint ? pointMetric(lastPoint, activeMetric) : null;
  const firstValue = firstPoint ? pointMetric(firstPoint, activeMetric) : null;
  const delta = latestValue != null && firstValue != null ? latestValue - firstValue : null;
  const totalVolume = points.reduce((sum, p) => sum + p.volume, 0);

  return (
    <AppCard p="md" style={style}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Text fw={600} c="var(--app-text)">
              {tr("trends.section.overview")}
            </Text>
            <Text size="xs" c="dimmed">
              {tr("trends.section.overviewDesc")}
            </Text>
          </Stack>
          <Group gap="lg" wrap="wrap">
            <Stat
              label={tr("trends.stat.latest")}
              value={latestValue}
              format={(n) => formatMetric(activeMetric, n)}
            />
            <Stat
              label={tr("trends.stat.change")}
              value={delta}
              format={(n) => `${n > 0 ? "+" : ""}${formatMetric(activeMetric, n)}`}
              valueColor={
                delta == null || delta === 0
                  ? undefined
                  : delta > 0
                    ? "var(--app-info)"
                    : "var(--app-warning)"
              }
            />
            <Stat
              label={tr("trends.stat.terms")}
              value={points.length}
              format={(n) => formatLocaleNumber(Math.round(n))}
            />
            <Stat
              label={tr("trends.stat.volume")}
              value={totalVolume}
              format={(n) => formatLocaleNumber(Math.round(n))}
            />
          </Group>
        </Group>

        {points.length === 0 ? (
          <Text c="dimmed" py="lg" ta="center">
            {tr("trends.empty.noResults")}
          </Text>
        ) : (
          <LineChart
            h={220}
            data={chartData}
            dataKey="term"
            series={[
              {
                name: "value",
                label: metricOptions.find((m) => m.value === activeMetric)?.label,
                color: METRIC_COLOR[activeMetric],
              },
            ]}
            curveType="monotone"
            connectNulls
            withDots={chartData.length <= 24}
            yAxisProps={
              activeMetric === "gpa"
                ? { domain: [0, 10] }
                : activeMetric === "volume"
                  ? { domain: [0, "auto"] }
                  : { domain: [0, 100] }
            }
            valueFormatter={(value) => formatMetric(activeMetric, value)}
          />
        )}
      </Stack>
    </AppCard>
  );
}

function DisciplinePreview() {
  const { grades, level, season, activeMetric, metricLabel } = useTrends();
  const data = useMemo(() => {
    if (!grades) return [];
    return computeDisciplineComparison(grades, { level, season })
      .map((row) => ({ discipline: row.discipline, value: pickMetric(row, activeMetric) }))
      .filter((row): row is { discipline: string; value: number } => row.value != null)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [grades, level, season, activeMetric]);

  if (data.length === 0) return null;
  return (
    <BarChart
      h={CATEGORY_PREVIEW_HEIGHT}
      data={data}
      dataKey="discipline"
      orientation="vertical"
      series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[activeMetric] }]}
      yAxisProps={{ width: 44 }}
      withXAxis={false}
      gridAxis="none"
      withLegend={false}
      valueFormatter={(value) => formatMetricValue(activeMetric, value)}
    />
  );
}

function SeasonPreview() {
  const { grades, discipline, level, programFilter, activeMetric, metricLabel } = useTrends();
  const data = useMemo(() => {
    if (!grades) return [];
    return computeSeasonComparison(grades, { discipline, level, programFilter })
      .map((row) => ({ season: tr(SEASON_KEY[row.season]), value: pickMetric(row, activeMetric) }))
      .filter((row): row is { season: string; value: number } => row.value != null);
  }, [grades, discipline, level, programFilter, activeMetric]);

  if (data.length === 0) return null;
  return (
    <BarChart
      h={CATEGORY_PREVIEW_HEIGHT}
      data={data}
      dataKey="season"
      series={[{ name: "value", label: metricLabel, color: METRIC_COLOR[activeMetric] }]}
      withYAxis={false}
      gridAxis="none"
      withLegend={false}
      valueFormatter={(value) => formatMetricValue(activeMetric, value)}
    />
  );
}

function LeaderboardPreview() {
  const { grades, level, season, disciplineNameByCode } = useTrends();
  const rows = useMemo(() => {
    if (!grades) return [];
    return computeDisciplineLeaderboard(grades, { minTermVolume: 50, level, season })
      .filter((d) => d.gpaDelta != null)
      .sort((a, b) => (b.gpaDelta ?? 0) - (a.gpaDelta ?? 0))
      .slice(0, 4);
  }, [grades, level, season]);

  if (rows.length === 0) return null;
  return (
    <Stack gap={6}>
      {rows.map((row) => (
        <Group key={row.discipline} justify="space-between" wrap="nowrap" gap="sm">
          <Text size="xs" c="var(--app-text)" truncate>
            {row.discipline}
            {disciplineNameByCode.get(row.discipline)
              ? ` · ${disciplineNameByCode.get(row.discipline)}`
              : ""}
          </Text>
          <Text
            size="xs"
            fw={600}
            c="var(--app-info)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {`+${formatLocaleNumber(row.gpaDelta ?? 0, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}`}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}

function FeedbackPreview() {
  const { data, loading } = useFeedbackData();
  const points = useMemo(() => {
    if (!data) return [];
    return feedbackOverallSeries(feedbackAllViews(data)).map((point) => ({
      term: formatTermLabelShort(point.termId),
      average: Number(point.average.toFixed(2)),
    }));
  }, [data]);

  if (loading && !data) {
    return <Skeleton height={CATEGORY_PREVIEW_HEIGHT} radius="sm" />;
  }
  if (points.length === 0) return null;
  return (
    <LineChart
      h={CATEGORY_PREVIEW_HEIGHT}
      data={points}
      dataKey="term"
      series={[
        { name: "average", label: tr("explore.feedback.stat.sentiment"), color: "var(--app-info)" },
      ]}
      curveType="monotone"
      connectNulls
      withDots={false}
      withXAxis={false}
      withYAxis={false}
      gridAxis="none"
      withLegend={false}
      yAxisProps={{ domain: [1, 5] }}
      valueFormatter={(value) => value.toFixed(1)}
    />
  );
}

function Stat({
  label,
  value,
  format,
  placeholder = "—",
  valueColor,
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
  placeholder?: string;
  valueColor?: string;
}) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" fw={600} style={{ letterSpacing: "0.02em" }}>
        {label}
      </Text>
      <Text
        fw={700}
        size="lg"
        style={{ color: valueColor ?? "var(--app-text)", fontVariantNumeric: "tabular-nums" }}
      >
        <AnimatedNumber value={value} format={format} placeholder={placeholder} />
      </Text>
    </Stack>
  );
}
