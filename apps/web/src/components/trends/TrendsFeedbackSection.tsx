import { useMemo } from "react";
import { SimpleGrid, Text } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { feedbackAllViews, feedbackOverallSeries, feedbackResponseRateSeries } from "@uoplan/core";
import { tr } from "../../i18n";
import { formatTermLabel, formatTermLabelShort } from "../../lib/term/termLabel";
import { useFeedbackData } from "../../hooks/useFeedbackData";
import { AppCard } from "../shared/AppCard";
import { TrendsSection } from "./TrendsSection";

const SENTIMENT_COLOR = "var(--app-info)";
const RATE_COLOR = "var(--app-success)";

/**
 * High-level, university-wide course-feedback trends: average sentiment across all
 * scale questions over time, and the overall response-rate trend. Lazily loads
 * `feedback.pb` via {@link useFeedbackData} the first time `/trends` is opened.
 */
export function TrendsFeedbackSection() {
  const { data, loading } = useFeedbackData();

  const { sentiment, rate } = useMemo(() => {
    if (!data) return { sentiment: [], rate: [] };
    const views = feedbackAllViews(data);
    return {
      sentiment: feedbackOverallSeries(views),
      rate: feedbackResponseRateSeries(views),
    };
  }, [data]);

  if (loading && !data) {
    return (
      <TrendsSection
        title={tr("trends.section.feedback")}
        description={tr("trends.section.feedbackDesc")}
      >
        <Text size="sm" c="dimmed">
          {tr("explore.feedback.loading")}
        </Text>
      </TrendsSection>
    );
  }

  if (sentiment.length === 0 && rate.length === 0) return null;

  return (
    <TrendsSection
      title={tr("trends.section.feedback")}
      description={tr("trends.section.feedbackDesc")}
    >
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
    </TrendsSection>
  );
}
