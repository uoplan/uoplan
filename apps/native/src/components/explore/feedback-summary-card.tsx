import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { LineChart } from "@/components/line-chart";
import { SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import {
  type FeedbackSectionView,
  feedbackHeadline,
  feedbackSentimentSeries,
} from "@/data/feedback-data";

/** A compact value-over-label statistic. */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text size="sm" weight="bold">
        {value}
      </Text>
      <Text size="xs" dimmed>
        {label}
      </Text>
    </View>
  );
}

/**
 * A short, tappable preview of a course's student evaluations — the native
 * analogue of the web `FeedbackSummaryCard`: an overall-sentiment sparkline plus
 * headline stats (sentiment / responses / response rate), linking to the full
 * feedback page. Renders nothing when there is no scale feedback.
 */
export function FeedbackSummaryCard({
  views,
  onPress,
}: {
  views: readonly FeedbackSectionView[];
  onPress: () => void;
}) {
  const headline = useMemo(() => feedbackHeadline(views), [views]);
  const series = useMemo(() => feedbackSentimentSeries(views), [views]);

  if (views.length === 0 || headline.satisfaction == null) return null;

  return (
    <SectionCard title="Student evaluations" onPressHeader={onPress}>
      {series.length > 1 ? (
        <View style={styles.chart}>
          <LineChart data={series} height={96} domain={[1, 5]} color={Surface.accent} />
        </View>
      ) : null}
      <View style={styles.stats}>
        <MiniStat label="Sentiment" value={`${headline.satisfaction.toFixed(2)} / 5`} />
        <MiniStat label="Responses" value={headline.totalResponses.toLocaleString()} />
        {headline.responseRate != null ? (
          <MiniStat label="Response rate" value={`${Math.round(headline.responseRate * 100)}%`} />
        ) : null}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  chart: {
    marginBottom: Spacing.two,
  },
  stats: {
    flexDirection: "row",
    gap: Spacing.five,
  },
  stat: {
    gap: 2,
  },
});
