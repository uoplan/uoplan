import { useMemo } from "react";
import { Box, Flex, Group, Skeleton, Stack, Text } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import { feedbackOverallSeries, feedbackSummary } from "@uoplan/core";
import type { FeedbackSectionView } from "@uoplan/core";
import { tr, useTr } from "../../../i18n";
import { formatTermLabel, formatTermLabelShort } from "../../../lib/term/termLabel";
import { EMPTY_EXPLORE_SEARCH } from "../../../lib/explore/exploreFilters";
import { AppCard } from "../../shared/AppCard";

const SENTIMENT_COLOR = "var(--app-info)";

type FeedbackRoute = "/explore/course/$course/feedback" | "/explore/professor/$slug/feedback";

/** A compact, stacked stat (value over label) sitting inline beside the chart. */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} style={{ flexShrink: 0 }}>
      <Text
        fw={700}
        size="sm"
        lh={1.15}
        style={{ color: "var(--app-text)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Text>
      <Text size="xs" c="dimmed" lh={1.15} style={{ whiteSpace: "nowrap" }}>
        {label}
      </Text>
    </Stack>
  );
}

/** A small tooltip: just the hovered term's rating on a 1-5 scale. */
function ChartTooltip({ payload }: { payload?: Array<{ value?: number | string }> }) {
  const raw = payload?.[0]?.value;
  if (raw == null) return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  return (
    <Box
      style={{
        background: "var(--app-surface)",
        border: "var(--app-border-width) solid var(--app-border)",
        borderRadius: "var(--app-radius-sm)",
        padding: "1px 6px",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--app-text)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {num.toFixed(2)} / 5
    </Box>
  );
}

/** The card's header row: "Student evaluations" label with a trailing arrow. */
function FeedbackCardHeader() {
  useTr();
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text fw={600} size="sm" c="var(--app-text)">
        {tr("explore.feedback.viewLink")}
      </Text>
      <IconArrowRight size={16} style={{ color: "var(--app-text-muted)" }} />
    </Group>
  );
}

/**
 * A short, clickable preview of a course/professor's student evaluations: the
 * "Student evaluations" title with an arrow, a small overall-sentiment sparkline,
 * and a few headline stats laid out inline beside it (so the card stays roughly
 * as tall as the chart). Stacks vertically on narrow screens. Links to the full
 * feedback page. Renders a loading placeholder, then the card, or `null` when no
 * data is available.
 */
export function FeedbackSummaryCard({
  to,
  params,
  views,
  loading,
}: {
  to: FeedbackRoute;
  params: Record<string, string>;
  views: readonly FeedbackSectionView[];
  loading: boolean;
}) {
  useTr();

  const overall = useMemo(() => feedbackOverallSeries(views), [views]);
  const summary = useMemo(() => feedbackSummary(views), [views]);

  const chartData = useMemo(
    () =>
      overall.map((p) => ({
        term: formatTermLabelShort(p.termId),
        fullTerm: formatTermLabel(p.termId),
        average: Number(p.average.toFixed(2)),
      })),
    [overall],
  );

  if (loading && views.length === 0) {
    return (
      <AppCard p="sm">
        <Stack gap={8}>
          <FeedbackCardHeader />
          <Flex
            direction={{ base: "column", xs: "row" }}
            gap={{ base: 6, xs: "md" }}
            align={{ base: "stretch", xs: "center" }}
            aria-hidden
          >
            <Box flex={{ base: "0 0 auto", xs: "1 1 120px" }} style={{ minWidth: 110 }}>
              <Skeleton height={44} radius="sm" />
            </Box>
            <Flex gap="md" wrap="nowrap" justify={{ base: "space-between", xs: "flex-start" }}>
              {Array.from({ length: 3 }, (_, i) => (
                <Stack key={i} gap={4} style={{ flexShrink: 0 }}>
                  <Skeleton height={12} width={36} radius="sm" />
                  <Skeleton height={9} width={48} radius="sm" />
                </Stack>
              ))}
            </Flex>
          </Flex>
        </Stack>
      </AppCard>
    );
  }

  if (views.length === 0) return null;

  const stats = (
    <Flex
      gap="md"
      wrap="nowrap"
      justify={{ base: "space-between", xs: "flex-start" }}
      style={{ flexShrink: 0 }}
    >
      <MiniStat
        label={tr("explore.feedback.cardStat.sentiment")}
        value={summary.overallAverage != null ? summary.overallAverage.toFixed(2) : "—"}
      />
      <MiniStat
        label={tr("explore.feedback.cardStat.responses")}
        value={summary.totalResponses.toLocaleString()}
      />
      {summary.responseRate != null ? (
        <MiniStat
          label={tr("explore.feedback.cardStat.rate")}
          value={`${Math.round(summary.responseRate * 100)}%`}
        />
      ) : null}
    </Flex>
  );

  return (
    <Link
      to={to}
      params={params as never}
      search={EMPTY_EXPLORE_SEARCH}
      style={{ textDecoration: "none", display: "block" }}
    >
      <AppCard p="sm" interactive>
        <Stack gap={8}>
          <FeedbackCardHeader />
          <Flex
            direction={{ base: "column", xs: "row" }}
            gap={{ base: 6, xs: "md" }}
            align={{ base: "stretch", xs: "center" }}
          >
            {chartData.length > 1 ? (
              <Box
                className="chart-cursor-inherit"
                flex={{ base: "0 0 auto", xs: "1 1 120px" }}
                style={{ minWidth: 110 }}
              >
                <LineChart
                  h={44}
                  data={chartData}
                  dataKey="term"
                  series={[{ name: "average", color: SENTIMENT_COLOR }]}
                  curveType="monotone"
                  connectNulls
                  withXAxis={false}
                  withYAxis={false}
                  gridAxis="none"
                  withDots={false}
                  yAxisProps={{ domain: [1, 5] }}
                  tooltipProps={{
                    content: ({ payload }) => <ChartTooltip payload={payload as never} />,
                  }}
                />
              </Box>
            ) : null}
            {stats}
          </Flex>
        </Stack>
      </AppCard>
    </Link>
  );
}
