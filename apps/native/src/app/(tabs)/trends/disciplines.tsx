import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@uoplan/ui";

import { distributionGpa } from "@uoplan/core/gradeDistribution";

import { BarChart } from "@/components/bar-chart";
import { DisciplineHeatmapChart } from "@/components/heatmap";
import { ResponsiveColumns } from "@/components/layout";
import { ScatterChart } from "@/components/scatter-chart";
import { RedesignScreen, ScreenHeader, SectionCard } from "@/components/redesign";
import { chartColorForIndex, Spacing, Surface } from "@/constants/theme";
import { useTrends } from "@/data/data-provider";
import { useAnalytics } from "@/lib/analytics";

/**
 * Trends → Disciplines. Compares grading across subjects (average-GPA bars),
 * plots class size against average grade (scatter), and ranks the biggest grade
 * risers. Mirrors the web Trends disciplines view. Real data comes from the live
 * grades dataset via the shared gradeTrends analytics.
 */
export default function TrendsDisciplinesScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const trends = useTrends();

  // Scatter: each point is a graded course (class size vs average grade). Use
  // the densest courses so the plot has real, readable signal.
  const scatter = useMemo(
    () =>
      [...trends.courses]
        .sort((a, b) => b.graded - a.graded)
        .slice(0, 80)
        .map((c, index) => ({
          x: c.graded,
          y: distributionGpa(c.distribution) ?? 0,
          label: c.code.split(" ")[0] ?? c.code,
          color: chartColorForIndex(index),
        }))
        .filter((p) => p.y > 0),
    [trends.courses],
  );

  useEffect(() => {
    analytics.capture("trends_discipline_viewed");
  }, [analytics]);

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Trends" onBack={() => router.back()}>
      <ScreenHeader title="Disciplines" subtitle="How grading differs across subjects" />

      <ResponsiveColumns gap={Spacing.three}>
        <SectionCard
          title="Average grade by discipline"
          subtitle="10-point scale, most recent term"
        >
          <BarChart
            data={trends.disciplineGpa.map((row, i) => ({ ...row, color: chartColorForIndex(i) }))}
            maxValue={10}
            formatValue={(v) => v.toFixed(0)}
          />
        </SectionCard>

        <SectionCard title="Class size vs average" subtitle="Each point is a course">
          <ScatterChart data={scatter} yDomain={[4, 9]} />
        </SectionCard>

        <SectionCard
          title="Grades over time"
          subtitle="Average GPA per discipline by year — red (low) to green (high)"
        >
          <DisciplineHeatmapChart heatmap={trends.disciplineHeatmap} />
        </SectionCard>

        <SectionCard title="Biggest risers" subtitle="Largest grade gains since the first term">
          <View style={styles.riserList}>
            {trends.risers.map((riser) => (
              <View key={riser.code} style={styles.riserRow}>
                <View style={styles.riserLabel}>
                  <Text size="sm" numberOfLines={1} color={Surface.label}>
                    {riser.prefix} · {riser.title}
                  </Text>
                </View>
                <Text size="sm" weight="bold" color={Surface.accent}>
                  +{riser.delta.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  riserList: {
    gap: Spacing.two,
  },
  riserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  riserLabel: {
    flex: 1,
  },
});
