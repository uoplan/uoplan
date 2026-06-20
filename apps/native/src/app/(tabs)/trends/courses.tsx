import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { distributionGpa, normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { Text } from "@uoplan/ui";

import { AreaChart } from "@/components/area-chart";
import { BarChart } from "@/components/bar-chart";
import { GradeHistogram } from "@/components/grade-histogram";
import { GradeLeaderboard } from "@/components/grade-leaderboard";
import { LineChart } from "@/components/line-chart";
import {
  type ChipOption,
  ChipRow,
  RedesignScreen,
  ScreenHeader,
  SectionCard,
} from "@/components/redesign";
import { ResponsiveColumns } from "@/components/layout";
import { ScatterChart } from "@/components/scatter-chart";
import {
  chartColorForIndex,
  GradeBandColor,
  SeasonColor,
  Spacing,
  Surface,
} from "@/constants/theme";
import { useTrends } from "@/data/data-provider";

/**
 * Trends → Choosing courses. The per-course signal explorer: pick a course to
 * drive its grade distribution, headline stats, term-GPA line + area trend, and
 * the highest-average leaderboard. Mirrors the web Trends course view. Real data
 * comes from the live grades dataset via the shared gradeTrends analytics.
 */
export default function TrendsCoursesScreen() {
  const router = useRouter();
  const trends = useTrends();

  // The chip row + leaderboard show the most-graded courses (so there is real,
  // dense data to chart); fall back to the first course otherwise.
  const topCourses = useMemo(
    () => [...trends.courses].sort((a, b) => b.graded - a.graded).slice(0, 16),
    [trends.courses],
  );
  const [selected, setSelected] = useState(() => topCourses[0]?.code ?? "");

  const course = useMemo(
    () => topCourses.find((c) => c.code === selected) ?? topCourses[0],
    [topCourses, selected],
  );
  const gradeViz = useMemo(
    () => (course ? normalizeGradeVizDistribution(course.distribution) : null),
    [course],
  );
  const gpa = useMemo(() => (course ? distributionGpa(course.distribution) : null), [course]);
  const termSeries = useMemo(
    () => (course ? trends.termSeriesFor(course.code) : []),
    [trends, course],
  );
  const gradeBands = useMemo(
    () => (course ? trends.gradeBandFor(course.code) : []),
    [trends, course],
  );
  const visibleGradeBands = useMemo(
    () => gradeBands.filter((band) => band.data.some((point) => point.value > 0)),
    [gradeBands],
  );
  const seasonComparison = useMemo(
    () => (course ? trends.seasonComparisonFor(course.code) : []),
    [trends, course],
  );
  const levelComparison = useMemo(
    () => (course ? trends.levelComparisonFor(course.code) : []),
    [trends, course],
  );
  const volumeGpaScatter = useMemo(
    () => (course ? trends.volumeGpaScatterFor(course.code) : []),
    [trends, course],
  );
  const professorSpread = useMemo(
    () => (course ? trends.professorSpreadFor(course.code) : []),
    [trends, course],
  );
  const courseDiscipline = course?.code.split(/\s+/)[0] ?? "this discipline";

  const courseChips: ChipOption[] = useMemo(
    () => topCourses.map((c) => ({ value: c.code, label: c.code })),
    [topCourses],
  );

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Trends" onBack={() => router.back()}>
      <ScreenHeader title="Choosing courses" subtitle="Per-course grade signals" />

      <ChipRow options={courseChips} value={selected} onSelect={setSelected} />

      <ResponsiveColumns gap={Spacing.three}>
        <SectionCard title={course?.code ?? "—"} subtitle={course?.title ?? ""}>
          {gradeViz ? (
            <GradeHistogram gradeViz={gradeViz} showSummary showStudentCount />
          ) : (
            <Text size="sm" dimmed>
              No grade data available.
            </Text>
          )}
          <View style={styles.statRow}>
            <Stat label="Average" value={gpa != null ? gpa.toFixed(2) : "—"} />
            <Stat label="Students" value={gradeViz ? gradeViz.total.toLocaleString() : "—"} />
            <Stat
              label="Passing"
              value={gradeViz ? `${Math.round(gradeViz.passingPercent)}%` : "—"}
            />
          </View>
        </SectionCard>

        {termSeries.length > 0 ? (
          <SectionCard title="Average grade over time" subtitle="10-point scale, by term">
            <LineChart data={termSeries} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Grade-band composition"
          subtitle="Share of each grade band across this course's terms."
        >
          {visibleGradeBands.length > 0 ? (
            <View style={styles.bandList}>
              {visibleGradeBands.map((band) => (
                <View key={band.id} style={styles.bandItem}>
                  <View style={styles.bandHeader}>
                    <View style={styles.bandLabel}>
                      <View
                        style={[styles.legendDot, { backgroundColor: GradeBandColor[band.id] }]}
                      />
                      <Text size="xs" weight="semibold" numberOfLines={1}>
                        {band.label}
                      </Text>
                    </View>
                    <Text size="xs" dimmed>
                      {Math.round(band.latest)}%
                    </Text>
                  </View>
                  <AreaChart
                    data={band.data}
                    height={78}
                    domain={[0, 100]}
                    color={GradeBandColor[band.id]}
                    formatValue={(value) => `${Math.round(value)}%`}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text size="sm" dimmed>
              No grade-band data available.
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title="Season effect"
          subtitle="Average GPA for this course by academic season."
        >
          {seasonComparison.length > 0 ? (
            <BarChart
              data={seasonComparison.map((point) => ({
                label: point.label,
                value: point.value,
                color: SeasonColor[point.season],
              }))}
              maxValue={10}
            />
          ) : (
            <Text size="sm" dimmed>
              No seasonal comparison available.
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title="Level effect"
          subtitle={`Average GPA by course level in ${courseDiscipline}.`}
        >
          {levelComparison.length > 0 ? (
            <BarChart data={levelComparison} maxValue={10} color={Surface.accent} />
          ) : (
            <Text size="sm" dimmed>
              No level comparison available.
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title="Popularity to GPA scatter"
          subtitle={`Each point is a ${courseDiscipline} course. Volume is graded students.`}
        >
          {volumeGpaScatter.length > 0 ? (
            <ScatterChart
              data={volumeGpaScatter.map((point, index) => ({
                ...point,
                color: chartColorForIndex(index),
              }))}
              yDomain={[0, 10]}
            />
          ) : (
            <Text size="sm" dimmed>
              No course scatter data available.
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title="Professor spread"
          subtitle="Average GPA by professor for the selected course."
        >
          {professorSpread.length > 0 ? (
            <View style={styles.professorList}>
              {professorSpread.map((professor, index) => {
                const widthPct = Math.max(6, Math.min(100, (professor.value / 10) * 100));
                return (
                  <View key={professor.name} style={styles.professorRow}>
                    <View style={styles.professorHeader}>
                      <Text size="xs" weight="semibold" numberOfLines={1}>
                        {professor.name}
                      </Text>
                      <Text size="xs" dimmed>
                        {professor.value.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.professorBar,
                          {
                            width: `${widthPct}%`,
                            backgroundColor: chartColorForIndex(index),
                          },
                        ]}
                      />
                    </View>
                    <Text size="xs" dimmed>
                      {professor.volume.toLocaleString()} graded
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text size="sm" dimmed>
              No professor comparison available.
            </Text>
          )}
        </SectionCard>

        {termSeries.length > 0 ? (
          <SectionCard title="Cumulative average trend" subtitle="Average GPA as an area trend.">
            <AreaChart data={termSeries} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Highest average grades"
          subtitle="Ranked on the 10-point scale. Tap a course to chart it."
        >
          <GradeLeaderboard courses={topCourses} selectedCode={selected} onSelect={setSelected} />
        </SectionCard>
      </ResponsiveColumns>
    </RedesignScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text size="lg" weight="semibold">
        {value}
      </Text>
      <Text size="xs" dimmed>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  bandList: {
    gap: Spacing.three,
  },
  bandItem: {
    gap: Spacing.one,
  },
  bandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  bandLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  professorList: {
    gap: Spacing.three,
  },
  professorRow: {
    gap: Spacing.one,
  },
  professorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Surface.border,
    overflow: "hidden",
  },
  professorBar: {
    height: "100%",
    borderRadius: 4,
  },
});
