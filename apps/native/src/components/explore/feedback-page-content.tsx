import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { LineChart } from "@/components/line-chart";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import {
  type FeedbackHeadline,
  type FeedbackQuestionChart,
  type FeedbackQuestionMeta,
  type FeedbackSectionView,
  feedbackHeadline,
  feedbackQuestionCharts,
  feedbackRateSeries,
} from "@/data/feedback-data";

/** One labelled stat tile in the 2×2 headline grid. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text size="xs" dimmed>
        {label}
      </Text>
      <Text size="lg" weight="bold">
        {value}
      </Text>
    </View>
  );
}

function StatGrid({ headline }: { headline: FeedbackHeadline }) {
  return (
    <View style={styles.grid}>
      <StatTile
        label="Overall sentiment"
        value={headline.satisfaction != null ? `${headline.satisfaction.toFixed(2)} / 5` : "—"}
      />
      <StatTile label="Total responses" value={headline.totalResponses.toLocaleString()} />
      <StatTile
        label="Response rate"
        value={headline.responseRate != null ? `${Math.round(headline.responseRate * 100)}%` : "—"}
      />
      <StatTile label="Terms" value={String(headline.termsCovered)} />
    </View>
  );
}

function QuestionChartCard({ chart }: { chart: FeedbackQuestionChart }) {
  return (
    <SectionCard title={chart.text}>
      <View style={styles.questionMeta}>
        <Text size="xs" dimmed>
          {chart.responsesTotal.toLocaleString()} responses
        </Text>
      </View>
      <LineChart data={chart.points} height={180} domain={[1, 5]} color={Surface.accent} />
    </SectionCard>
  );
}

/**
 * Shared course/professor student-evaluation layout — the native analogue of the
 * web `ExploreFeedbackContent`: a back link + title, a 2×2 headline stat grid, a
 * response-rate trend, and one average-over-time line chart per scale question.
 */
export function FeedbackPageContent({
  title,
  backLabel,
  onBack,
  views,
  questions,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  views: readonly FeedbackSectionView[];
  questions: readonly FeedbackQuestionMeta[];
}) {
  const router = useRouter();
  const headline = feedbackHeadline(views);
  const rateSeries = feedbackRateSeries(views);
  const questionCharts = feedbackQuestionCharts(views, questions);

  if (views.length === 0 || headline.satisfaction == null) {
    return (
      <RedesignScreen gap={Spacing.three} backLabel={backLabel} onBack={onBack}>
        <ScreenHeader title="Student evaluations" />
        <Text dimmed>No evaluation data is available yet.</Text>
      </RedesignScreen>
    );
  }

  return (
    <RedesignScreen gap={Spacing.three} backLabel={backLabel} onBack={onBack}>
      <ScreenHeader title="Student evaluations" subtitle={title} />

      <StatGrid headline={headline} />

      {rateSeries.length > 1 ? (
        <SectionCard title="Response rate over time">
          <LineChart
            data={rateSeries}
            height={180}
            domain={[0, 100]}
            color={Surface.accent}
            formatValue={(v) => `${Math.round(v)}%`}
          />
        </SectionCard>
      ) : null}

      <Text size="sm" weight="bold">
        Questions over time
      </Text>
      {questionCharts.length === 0 ? (
        <Text dimmed>No rated questions to chart.</Text>
      ) : (
        questionCharts.map((chart) => <QuestionChartCard key={chart.questionId} chart={chart} />)
      )}
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  questionMeta: {
    marginBottom: Spacing.two,
  },
});
