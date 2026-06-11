import { Box, Collapse, Group, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { LineChart } from "@mantine/charts";
import { IconChevronDown } from "@tabler/icons-react";
import {
  feedbackAllViews,
  feedbackOverallSeries,
  feedbackQuestionSeries,
  feedbackResponseRateSeries,
} from "@uoplan/core";
import { useMemo, useState } from "react";
import { tr, useTr } from "../../i18n";
import { formatTermLabel, formatTermLabelShort } from "../../lib/term/termLabel";
import { colorForIndex } from "../../lib/trends/palette";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import { AppCard } from "../shared/AppCard";
import { MiniChartTooltip } from "../shared/MiniChartTooltip";
import { TrendsGridSkeleton } from "./TrendsSkeletons";
import { FeedbackQuestionChart } from "../explore/feedback/FeedbackQuestionChart";

const SENTIMENT_COLOR = "var(--app-info)";
const RATE_COLOR = "var(--app-success)";

/**
 * University-wide course-feedback trends: overall sentiment and response rate
 * over time, plus the most-answered survey questions tracked individually.
 * Lazily loads `feedback.pb` the first time the page is opened.
 */
export function TrendsFeedbackPage() {
  useTr();
  const { data, loading } = useFeedbackData();
  const [openQuestionIds, setOpenQuestionIds] = useState<ReadonlySet<number>>(() => new Set());
  const showScaleLabels = useMediaQuery("(min-width: 48em)", true, {
    getInitialValueInEffect: false,
  });

  const { sentiment, rate, questions } = useMemo(() => {
    if (!data) return { sentiment: [], rate: [], questions: [] };
    const views = feedbackAllViews(data);
    return {
      sentiment: feedbackOverallSeries(views),
      rate: feedbackResponseRateSeries(views),
      questions: feedbackQuestionSeries(views, data.questions),
    };
  }, [data]);

  if (loading && !data) {
    return <TrendsGridSkeleton count={2} height={300} />;
  }

  if (sentiment.length === 0 && rate.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {tr("trends.chart.empty")}
      </Text>
    );
  }

  const toggleQuestion = (questionId: number) => {
    setOpenQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

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
        <Stack gap="sm">
          <Stack gap={2}>
            <Text fw={600} size="sm">
              {tr("trends.feedback.byQuestion")}
            </Text>
            <Text size="xs" c="dimmed">
              {tr("trends.feedback.byQuestionDesc")}
            </Text>
          </Stack>
          <Stack gap="xs">
            {questions.map((series, i) => {
              const color = colorForIndex(i);
              const current = series.points.at(-1)?.average ?? null;
              const isOpen = openQuestionIds.has(series.questionId);
              const panelId = `trends-feedback-question-${String(series.questionId)}`;
              const chartData = series.points.map((p) => ({
                term: formatTermLabelShort(p.termId),
                fullTerm: formatTermLabel(p.termId),
                average: Number(p.average.toFixed(2)),
              }));
              return (
                <AppCard key={series.questionId} p="sm">
                  <UnstyledButton
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    onClick={() => {
                      toggleQuestion(series.questionId);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      borderRadius: "var(--app-radius-md)",
                    }}
                  >
                    <Group wrap="nowrap" align="center" gap="md">
                      <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
                        {series.text}
                      </Text>
                      <Text
                        fw={700}
                        size="lg"
                        c={color}
                        w={48}
                        ta="right"
                        style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
                      >
                        {current != null ? current.toFixed(2) : "—"}
                      </Text>
                      <Box w={{ base: 104, xs: 140, sm: 176 }} style={{ flexShrink: 0 }}>
                        <LineChart
                          h={44}
                          data={chartData}
                          dataKey="term"
                          series={[
                            { name: "average", label: tr("trends.feedback.questionValue"), color },
                          ]}
                          withXAxis={false}
                          withYAxis={false}
                          gridAxis="none"
                          withDots={false}
                          curveType="monotone"
                          connectNulls
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
                      <IconChevronDown
                        size={16}
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          color: "var(--app-muted-fg)",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 150ms ease",
                        }}
                      />
                    </Group>
                  </UnstyledButton>
                  <Collapse expanded={isOpen}>
                    <Box
                      id={panelId}
                      pt="sm"
                      mt="sm"
                      style={{
                        borderTop: "1px solid var(--app-border)",
                      }}
                    >
                      <FeedbackQuestionChart
                        questionText={series.text}
                        points={series.points}
                        optionLabels={data?.questions[series.questionId]?.options ?? []}
                        responsesTotal={series.points.reduce((sum, p) => sum + p.responses, 0)}
                        showScaleLabels={showScaleLabels}
                        color={color}
                        showQuestionHeader={false}
                        showResponsesBadge={false}
                        showOptionsPopover={false}
                      />
                    </Box>
                  </Collapse>
                </AppCard>
              );
            })}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
