import { useMemo } from "react";
import { Box, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { m } from "framer-motion";
import { feedbackQuestionSeries, feedbackResponseRateSeries, feedbackSummary } from "@uoplan/core";
import type { FeedbackQuestionMeta, FeedbackSectionView } from "@uoplan/core";
import { tr, useTr } from "../../../i18n";
import { AppCard } from "../../shared/AppCard";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../../lib/explore/accordionPadding";
import { FeedbackQuestionChart } from "./FeedbackQuestionChart";
import { FeedbackRateLineChart } from "./feedbackChartShared";

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
  views,
  questions,
  loading,
}: {
  title: string;
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
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
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
                <FeedbackRateLineChart
                  height={220}
                  points={rateSeries}
                  withDots={showScaleLabels && rateSeries.length <= 24}
                  withTooltip
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
                    <FeedbackQuestionChart
                      questionText={q.text}
                      points={q.points}
                      optionLabels={questions[q.questionId]?.options ?? []}
                      responsesTotal={q.points.reduce((s, p) => s + p.responses, 0)}
                      showScaleLabels={showScaleLabels}
                    />
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
