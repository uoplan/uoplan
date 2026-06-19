import { useMemo } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { BasketFab } from "@/components/basket-fab";
import { LineChart } from "@/components/line-chart";
import { ResponsiveColumns } from "@/components/layout";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { useFeedback } from "@/data/data-provider";
import { type FeedbackQuestionChart, trendsFeedbackData } from "@/data/feedback-data";

/**
 * Trends → Course feedback. University-wide student-evaluation charts from the
 * live feedback.pb dataset, mirroring the web Trends feedback view.
 */
export default function TrendsFeedbackScreen() {
  const router = useRouter();
  const feedback = useFeedback();
  const data = useMemo(() => trendsFeedbackData(feedback), [feedback]);
  const hasFeedback =
    data.sentiment.length > 0 || data.rate.length > 0 || data.questions.length > 0;

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel="Trends"
      onBack={() => router.back()}
      cart={<BasketFab />}
      onSettings={() => router.push("/more")}
    >
      <ScreenHeader title="Course feedback" subtitle="University-wide satisfaction over time" />

      {hasFeedback ? (
        <>
          <ResponsiveColumns gap={Spacing.three}>
            {data.sentiment.length > 0 ? (
              <SectionCard
                title="Overall sentiment over time"
                subtitle="Average student rating (1–5), university-wide, by term"
              >
                <LineChart
                  data={data.sentiment}
                  height={180}
                  domain={[1, 5]}
                  color={Surface.accent}
                  formatValue={(v) => v.toFixed(1)}
                />
              </SectionCard>
            ) : null}

            {data.rate.length > 0 ? (
              <SectionCard
                title="Response rate over time"
                subtitle="Respondents / invited students, by term"
              >
                <LineChart
                  data={data.rate}
                  height={180}
                  domain={[0, 100]}
                  color={Surface.accent}
                  formatValue={(v) => `${Math.round(v)}%`}
                />
              </SectionCard>
            ) : null}
          </ResponsiveColumns>

          <Text size="sm" weight="bold">
            Questions over time
          </Text>
          {data.questions.length === 0 ? (
            <Text size="sm" dimmed>
              No rated questions to chart.
            </Text>
          ) : (
            <ResponsiveColumns gap={Spacing.three}>
              {data.questions.map((chart) => (
                <QuestionChartCard key={chart.questionId} chart={chart} />
              ))}
            </ResponsiveColumns>
          )}
        </>
      ) : (
        <Text size="sm" dimmed>
          No evaluation data is available yet.
        </Text>
      )}

      <SectionCard title="What this measures">
        <Text size="sm" dimmed>
          Each term, students rate their courses on a 1–5 satisfaction scale. This trend blends
          every rated course across the university, so you can see whether the overall experience is
          improving term over term.
        </Text>
      </SectionCard>
    </RedesignScreen>
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

const styles = StyleSheet.create({
  questionMeta: {
    marginBottom: Spacing.two,
  },
});
