import { SimpleGrid, Stack, Text } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import {
  feedbackAllViews,
  feedbackOverallSeries,
  feedbackQuestionSeries,
  feedbackResponseRateSeries,
} from "@uoplan/core";
import { useMemo } from "react";
import { tr, useTr } from "../../i18n";
import { formatTermLabel, formatTermLabelShort } from "../../lib/term/termLabel";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import { AppCard } from "../shared/AppCard";
import { TrendsGridSkeleton } from "./TrendsSkeletons";

const SENTIMENT_COLOR = "var(--app-info)";
const RATE_COLOR = "var(--app-success)";

/** Distinct series colours for the per-question chart. */
const QUESTION_COLORS = ["violet.5", "teal.6", "blue.5", "orange.5", "pink.5", "lime.6"];

const MAX_QUESTIONS = 6;

/** Shorten a long survey-question label so the legend stays readable. */
function shortQuestion(text: string): string {
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

/**
 * University-wide course-feedback trends: overall sentiment and response rate
 * over time, plus the most-answered survey questions tracked individually.
 * Lazily loads `feedback.pb` the first time the page is opened.
 */
export function TrendsFeedbackPage() {
  useTr();
  const { data, loading } = useFeedbackData();

  const { sentiment, rate, questions } = useMemo(() => {
    if (!data) return { sentiment: [], rate: [], questions: [] };
    const views = feedbackAllViews(data);
    return {
      sentiment: feedbackOverallSeries(views),
      rate: feedbackResponseRateSeries(views),
      questions: feedbackQuestionSeries(views, data.questions).slice(0, MAX_QUESTIONS),
    };
  }, [data]);

  if (loading && !data) {
    return <TrendsGridSkeleton count={2} height={240} />;
  }

  if (sentiment.length === 0 && rate.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {tr("trends.chart.empty")}
      </Text>
    );
  }

  // Merge every question's per-term average into a single keyed-by-term dataset.
  const questionChartData = (() => {
    const byTerm = new Map<number, Record<string, string | number>>();
    for (const series of questions) {
      for (const point of series.points) {
        let row = byTerm.get(point.termId);
        if (!row) {
          row = {
            term: formatTermLabelShort(point.termId),
            fullTerm: formatTermLabel(point.termId),
          };
          byTerm.set(point.termId, row);
        }
        row[`q${series.questionId}`] = Number(point.average.toFixed(2));
      }
    }
    return [...byTerm.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  })();

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <AppCard p="md">
          <Text fw={600} size="sm" mb={8}>
            {tr("trends.feedback.sentiment")}
          </Text>
          <LineChart
            h={240}
            data={sentiment.map((p) => ({
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
            withDots={sentiment.length <= 24}
            yAxisProps={{ domain: [1, 5] }}
            valueFormatter={(value) => value.toFixed(2)}
          />
        </AppCard>
        <AppCard p="md">
          <Text fw={600} size="sm" mb={8}>
            {tr("trends.feedback.responseRate")}
          </Text>
          <LineChart
            h={240}
            data={rate.map((p) => ({
              term: formatTermLabelShort(p.termId),
              fullTerm: formatTermLabel(p.termId),
              rate: Math.round(p.rate * 100),
            }))}
            dataKey="term"
            series={[
              { name: "rate", label: tr("explore.feedback.stat.responseRate"), color: RATE_COLOR },
            ]}
            curveType="monotone"
            connectNulls
            withDots={rate.length <= 24}
            yAxisProps={{ domain: [0, 100] }}
            valueFormatter={(value) => `${value}%`}
          />
        </AppCard>
      </SimpleGrid>

      {questions.length > 0 ? (
        <AppCard p="md">
          <Stack gap={2} mb={8}>
            <Text fw={600} size="sm">
              {tr("trends.feedback.byQuestion")}
            </Text>
            <Text size="xs" c="dimmed">
              {tr("trends.feedback.byQuestionDesc")}
            </Text>
          </Stack>
          <LineChart
            h={320}
            data={questionChartData}
            dataKey="term"
            series={questions.map((series, i) => ({
              name: `q${series.questionId}`,
              label: shortQuestion(series.text),
              color: QUESTION_COLORS[i % QUESTION_COLORS.length],
            }))}
            curveType="monotone"
            connectNulls
            withDots={false}
            yAxisProps={{ domain: [1, 5] }}
            valueFormatter={(value) => value.toFixed(2)}
            withLegend
          />
        </AppCard>
      ) : null}
    </Stack>
  );
}
