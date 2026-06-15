import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { BarChart } from "@/components/bar-chart";
import { LineChart } from "@/components/line-chart";
import { ResponsiveColumns } from "@/components/layout";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { BasketHeaderButton } from "@/components/basket-header-button";
import { chartColorForIndex, SeasonColor, Spacing, Surface } from "@/constants/theme";
import { useFeedback, useTrends } from "@/data/data-provider";
import { trendsFeedbackData } from "@/data/feedback-data";

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text size="xs" dimmed>
        {label}
      </Text>
      <Text size="lg" weight="bold" color={accent ? Surface.accent : Surface.label}>
        {value}
      </Text>
    </View>
  );
}

/** Tiny gradient-free "wave" preview for the feedback card (no axis labels). */
function FeedbackWave({ points }: { points: { value: number }[] }) {
  const series = points.length > 0 ? points : [{ value: 0 }];
  const max = Math.max(...series.map((p) => p.value));
  const min = Math.min(...series.map((p) => p.value));
  const span = max - min || 1;
  return (
    <View style={styles.wave}>
      {series.map((point, i) => (
        <View key={i} style={[styles.waveBar, { height: 8 + ((point.value - min) / span) * 28 }]} />
      ))}
    </View>
  );
}

/**
 * Trends hub — the native analytics dashboard mirroring the web mobile Grade
 * trends page: an Overview card (headline metrics + the university-wide term-GPA
 * line), then arrow-linked section cards for Disciplines (bar chart), Choosing
 * courses (season signals), Disciplines over time (risers), and Course feedback
 * (sentiment wave). Each arrow pushes the matching detail screen.
 */
export default function TrendsHubScreen() {
  const router = useRouter();
  const trends = useTrends();
  const feedback = useFeedback();
  const feedbackTrends = useMemo(() => trendsFeedbackData(feedback), [feedback]);
  const overview = trends.overview;

  return (
    <RedesignScreen
      gap={Spacing.three}
      cart={<BasketHeaderButton />}
      onSettings={() => router.push("/more")}
    >
      <ScreenHeader
        title="Grade trends"
        subtitle="How grades have shifted over time, across every course and professor on record."
      />

      <ResponsiveColumns gap={Spacing.three}>
        <SectionCard
          title="Overview"
          subtitle="Headline metrics and how grades have shifted over time."
        >
          <View style={styles.metricRow}>
            <Metric label="Latest term" value={overview.latestTerm.toFixed(1)} />
            <Metric
              label="Change since first"
              value={`${overview.change >= 0 ? "+" : ""}${overview.change.toFixed(1)}`}
              accent
            />
            <Metric label="Terms" value={String(overview.terms)} />
          </View>
          <View style={styles.gradedRow}>
            <Text size="xs" dimmed>
              Graded results
            </Text>
            <Text size="xl" weight="bold">
              {overview.graded.toLocaleString()}
            </Text>
          </View>
          <LineChart
            data={trends.overallTermSeries}
            height={150}
            domain={[0, 10]}
            formatValue={(v) => v.toFixed(1)}
          />
        </SectionCard>

        <SectionCard
          title="Disciplines"
          subtitle="Compare grading across subjects and watch it evolve year over year."
          onPressHeader={() => router.push("/trends/disciplines")}
        >
          <BarChart
            data={trends.disciplineGpa.map((row, i) => ({ ...row, color: chartColorForIndex(i) }))}
            maxValue={10}
            formatValue={(v) => v.toFixed(0)}
          />
        </SectionCard>

        <SectionCard
          title="Choosing courses"
          subtitle="Signals to help you pick electives, sections, and the right term."
          onPressHeader={() => router.push("/trends/courses")}
        >
          <View style={styles.seasonRow}>
            {trends.seasonGpa.map((season) => (
              <View key={season.label} style={styles.season}>
                <View style={styles.seasonBarTrack}>
                  <View
                    style={[
                      styles.seasonBar,
                      {
                        height: `${(season.value / 10) * 100}%`,
                        backgroundColor: SeasonColor[season.season],
                      },
                    ]}
                  />
                </View>
                <Text size="xs" dimmed align="center">
                  {season.label}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title="Disciplines over time"
          subtitle="Biggest risers, easiest, and hardest disciplines and courses."
          onPressHeader={() => router.push("/trends/disciplines")}
        >
          <View style={styles.riserList}>
            {trends.risers.slice(0, 4).map((riser) => (
              <View key={riser.code} style={styles.riserRow}>
                <Text size="sm" numberOfLines={1} color={Surface.label}>
                  {riser.prefix} · {riser.title}
                </Text>
                <Text size="sm" weight="bold" color={Surface.accent}>
                  +{riser.delta.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title="Leaderboard"
          subtitle="Rank biggest risers, easiest subjects, and hardest subjects."
          onPressHeader={() => router.push("/trends/leaderboard")}
        >
          <View style={styles.riserList}>
            {trends.risers.slice(0, 3).map((riser) => (
              <View key={riser.code} style={styles.riserRow}>
                <Text size="sm" numberOfLines={1} color={Surface.label}>
                  {riser.prefix} · {riser.title}
                </Text>
                <Text size="sm" weight="bold" color={Surface.accent}>
                  +{riser.delta.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title="Course feedback"
          subtitle="How students rated their courses across terms, university-wide."
          onPressHeader={() => router.push("/trends/feedback")}
        >
          {feedbackTrends.sentiment.length > 0 ? (
            <FeedbackWave points={feedbackTrends.sentiment} />
          ) : (
            <Text size="sm" dimmed>
              No feedback data available.
            </Text>
          )}
        </SectionCard>
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  gradedRow: {
    gap: 2,
    marginBottom: Spacing.two,
  },
  seasonRow: {
    flexDirection: "row",
    gap: Spacing.three,
    height: 150,
  },
  season: {
    flex: 1,
    gap: Spacing.one,
  },
  seasonBarTrack: {
    flex: 1,
    justifyContent: "flex-end",
    borderRadius: 8,
    overflow: "hidden",
  },
  seasonBar: {
    width: "100%",
    borderRadius: 8,
  },
  riserList: {
    gap: Spacing.two,
  },
  riserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  wave: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 44,
  },
  waveBar: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: Surface.accent,
  },
});
