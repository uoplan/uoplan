import { useMemo } from "react";
import { Badge, Box, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { LineChart } from "@mantine/charts";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";
import { m } from "framer-motion";
import {
  feedbackQuestionSeries,
  feedbackResponseRateSeries,
  feedbackSummary,
  type FeedbackQuestionMeta,
  type FeedbackSectionView,
} from "@uoplan/core";
import { useTr, tr } from "../../../i18n";
import { formatTermLabel, formatTermLabelShort } from "../../../lib/term/termLabel";
import { EMPTY_EXPLORE_SEARCH } from "../../../lib/explore/exploreFilters";
import { AppCard } from "../../shared/AppCard";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../ExploreProfessorGradesLayout";

const SENTIMENT_COLOR = "var(--app-info)";
const RATE_COLOR = "var(--app-success)";
const QUESTION_CHART_HEIGHT = 200;
// The chart's plot area (where 5..1 are drawn) is inset from the container by the
// Recharts default top margin and, at the bottom, the default margin plus the
// x-axis height — so the legend endpoints line up with the graph's top and bottom.
const CHART_PLOT_TOP = 5;
const CHART_PLOT_BOTTOM = 35;

/** Sentence-case a lowercase data label ("strongly agree" -> "Strongly agree"). */
function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * A compact chart tooltip: the hovered term and its value in a small chip, instead
 * of Mantine's default series popover. Paired with the chart's vertical cursor.
 */
function MiniChartTooltip({
  payload,
  format,
}: {
  payload?: Array<{ value?: number | string; payload?: { fullTerm?: string } }>;
  format: (value: number) => string;
}) {
  const point = payload?.[0];
  if (point?.value == null) return null;
  const num = typeof point.value === "number" ? point.value : Number(point.value);
  const term = point.payload?.fullTerm;
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
      {term ? `${term} · ` : ""}
      {format(num)}
    </Box>
  );
}

/**
 * A vertical response scale that stands in for the chart's y-axis: every option
 * is placed at its score position (best at the top = 5, worst at the bottom = 1),
 * evenly spaced and aligned with the graph's plot area, with a success->danger
 * track. Rendered only when the option labels are known.
 */
function FeedbackScaleLegend({
  options,
  showLabels,
}: {
  options: readonly string[];
  showLabels: boolean;
}) {
  if (options.length < 2) return null;
  const last = options.length - 1;
  return (
    <Box
      style={{
        position: "relative",
        width: showLabels ? 150 : 24,
        height: QUESTION_CHART_HEIGHT,
        flex: "none",
      }}
    >
      {/* The scale track runs from the top of the chart down to roughly the bottom
          of the "1" (its centre sits on the plot baseline, so add half a line). */}
      <Box
        style={{
          position: "absolute",
          top: 0,
          bottom: CHART_PLOT_BOTTOM - 6,
          right: 0,
          width: 3,
          borderRadius: "var(--app-radius-pill)",
          background:
            "linear-gradient(180deg, var(--app-success), var(--app-warning), var(--app-danger))",
        }}
      />
      {/* The numbers/labels align with the plot area (where 5..1 are drawn). */}
      <Box
        style={{
          position: "absolute",
          top: CHART_PLOT_TOP,
          bottom: CHART_PLOT_BOTTOM,
          right: 0,
          left: 0,
        }}
      >
        {options.map((option, i) => {
          // Best-first: option 0 sits at the top (score 5), the last at the bottom
          // (score 1); the score is only labelled at the two endpoints (the axis).
          const score = i === 0 ? "5" : i === last ? "1" : "";
          return (
            <Group
              key={`${String(i)}-${option}`}
              gap={6}
              wrap="nowrap"
              align="center"
              justify="flex-end"
              style={{
                position: "absolute",
                right: 10,
                left: 0,
                top: `${String((i / last) * 100)}%`,
                transform: "translateY(-50%)",
              }}
            >
              {showLabels ? (
                <Text size="xs" c="dimmed" truncate style={{ textAlign: "right" }}>
                  {sentenceCase(option)}
                </Text>
              ) : null}
              <Text
                size="xs"
                fw={700}
                c="var(--app-text)"
                style={{ width: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              >
                {score}
              </Text>
            </Group>
          );
        })}
      </Box>
    </Box>
  );
}

function FeedbackStatCard({ label, value }: { label: string; value: string }) {
  return (
    <AppCard p="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" fw={600} style={{ letterSpacing: "0.02em" }}>
          {label}
        </Text>
        <Text
          fw={700}
          size="lg"
          style={{ color: "var(--app-text)", fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </Text>
      </Stack>
    </AppCard>
  );
}

/**
 * Shared course/professor feedback layout: a back link + title, a high-level
 * summary card row, a response-rate trend, and one average-over-time line chart
 * per scale question. Both feedback routes feed it the relevant section views.
 */
export function ExploreFeedbackContent({
  title,
  backLink,
  views,
  questions,
  loading,
}: {
  title: string;
  backLink: { to: string; params: Record<string, string>; label: string };
  views: readonly FeedbackSectionView[];
  questions: readonly FeedbackQuestionMeta[];
  loading: boolean;
}) {
  useTr();

  const summary = useMemo(() => feedbackSummary(views), [views]);
  const series = useMemo(() => feedbackQuestionSeries(views, questions), [views, questions]);
  const rateSeries = useMemo(() => feedbackResponseRateSeries(views), [views]);

  const hasData = views.length > 0;
  // On narrow screens only the gradient track + endpoint numbers remain; the
  // per-option labels would crowd the chart, so they are hidden.
  const showScaleLabels = useMediaQuery("(min-width: 48em)", true, {
    getInitialValueInEffect: false,
  });

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack
        gap="lg"
        style={{
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          paddingTop: 4,
          paddingBottom: 48,
        }}
      >
        <Box>
          <Link
            to={backLink.to}
            params={backLink.params}
            search={EMPTY_EXPLORE_SEARCH}
            style={{
              color: "var(--app-text-muted)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--mantine-font-size-sm)",
            }}
          >
            <IconArrowLeft size={16} />
            {backLink.label}
          </Link>
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }} mt={8}>
            {title}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {tr("explore.feedback.subtitle")}
          </Text>
        </Box>

        {!hasData ? (
          <Text c="dimmed" size="sm">
            {loading ? tr("explore.feedback.loading") : tr("explore.feedback.empty")}
          </Text>
        ) : (
          <>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <FeedbackStatCard
                label={tr("explore.feedback.stat.sentiment")}
                value={
                  summary.overallAverage != null ? `${summary.overallAverage.toFixed(2)} / 5` : "—"
                }
              />
              <FeedbackStatCard
                label={tr("explore.feedback.stat.responses")}
                value={summary.totalResponses.toLocaleString()}
              />
              <FeedbackStatCard
                label={tr("explore.feedback.stat.responseRate")}
                value={
                  summary.responseRate != null ? `${Math.round(summary.responseRate * 100)}%` : "—"
                }
              />
              <FeedbackStatCard
                label={tr("explore.feedback.stat.terms")}
                value={String(summary.termsCovered)}
              />
            </SimpleGrid>

            {rateSeries.length > 1 ? (
              <AppCard p="md">
                <Text fw={600} size="sm" mb={8}>
                  {tr("explore.feedback.responseRateTrend")}
                </Text>
                <LineChart
                  h={220}
                  data={rateSeries.map((p) => ({
                    term: formatTermLabelShort(p.termId),
                    fullTerm: formatTermLabel(p.termId),
                    rate: Math.round(p.rate * 100),
                  }))}
                  dataKey="term"
                  series={[
                    {
                      name: "rate",
                      label: tr("explore.feedback.stat.responseRate"),
                      color: RATE_COLOR,
                    },
                  ]}
                  curveType="monotone"
                  connectNulls
                  withDots={showScaleLabels && rateSeries.length <= 24}
                  yAxisProps={{ domain: [0, 100] }}
                  valueFormatter={(value) => `${value}%`}
                  tooltipProps={{
                    content: ({ payload }) => (
                      <MiniChartTooltip
                        payload={payload as never}
                        format={(v) => `${String(Math.round(v))}%`}
                      />
                    ),
                  }}
                />
              </AppCard>
            ) : null}

            <Stack gap="md">
              <Text fw={600} size="sm">
                {tr("explore.feedback.questionsHeading")}
              </Text>
              {series.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {tr("explore.feedback.noScaleQuestions")}
                </Text>
              ) : (
                series.map((q) => (
                  <AppCard key={q.questionId} p="md">
                    <Group gap="sm" mb={8} wrap="nowrap" align="flex-start" justify="space-between">
                      <Text fw={600} size="sm" style={{ lineHeight: 1.4 }}>
                        {q.text}
                      </Text>
                      {showScaleLabels ? (
                        <Badge variant="light" size="sm" radius="sm" style={{ flexShrink: 0 }}>
                          {tr("explore.feedback.responsesCount", {
                            count: q.points.reduce((s, p) => s + p.responses, 0),
                          })}
                        </Badge>
                      ) : null}
                    </Group>
                    <Group gap="md" wrap="nowrap" align="center">
                      <FeedbackScaleLegend
                        options={questions[q.questionId]?.options ?? []}
                        showLabels={showScaleLabels}
                      />
                      <Box style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <LineChart
                          h={QUESTION_CHART_HEIGHT}
                          data={q.points.map((p) => ({
                            term: formatTermLabelShort(p.termId),
                            fullTerm: formatTermLabel(p.termId),
                            average: Number(p.average.toFixed(2)),
                          }))}
                          dataKey="term"
                          series={[
                            {
                              name: "average",
                              label: tr("explore.feedback.stat.sentiment"),
                              color: SENTIMENT_COLOR,
                            },
                          ]}
                          curveType="monotone"
                          connectNulls
                          withDots={showScaleLabels && q.points.length <= 24}
                          withYAxis={false}
                          yAxisProps={{ domain: [1, 5] }}
                          valueFormatter={(value) => value.toFixed(2)}
                          tooltipProps={{
                            content: ({ payload }) => (
                              <MiniChartTooltip
                                payload={payload as never}
                                format={(v) => v.toFixed(2)}
                              />
                            ),
                          }}
                        />
                      </Box>
                    </Group>
                  </AppCard>
                ))
              )}
            </Stack>
          </>
        )}
      </Stack>
    </m.div>
  );
}
