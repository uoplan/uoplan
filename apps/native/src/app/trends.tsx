import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";

import { distributionGpa, normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { Paper, Stack, Text, Title } from "@uoplan/ui";

import { AreaChart } from "@/components/area-chart";
import { BarChart } from "@/components/bar-chart";
import { GradeHistogram } from "@/components/grade-histogram";
import { GradeLeaderboard } from "@/components/grade-leaderboard";
import { LineChart } from "@/components/line-chart";
import { ScatterChart } from "@/components/scatter-chart";
import { ScreenScaffold } from "@/components/screen-scaffold";
import { Spacing, Surface } from "@/constants/theme";
import { SAMPLE_COURSE_GRADES, SAMPLE_TERM_GPA } from "@/data/sample-grades";

function CoursePill({
  code,
  active,
  onPress,
}: {
  code: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <RNText style={[styles.pillLabel, active && styles.pillLabelActive]}>{code}</RNText>
    </Pressable>
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

/**
 * Trends tab — historical grade distributions. A course picker drives the shared
 * grade histogram (`@uoplan/core` math + the `GradeHistogram` native leaf),
 * matching the web app's GradeDistribution chart. Sample distributions stand in
 * until the live `.pb` data layer is wired.
 */
export default function TrendsScreen() {
  const [selected, setSelected] = useState(SAMPLE_COURSE_GRADES[0].code);

  const course = useMemo(
    () => SAMPLE_COURSE_GRADES.find((c) => c.code === selected) ?? SAMPLE_COURSE_GRADES[0],
    [selected],
  );

  const gradeViz = useMemo(() => normalizeGradeVizDistribution(course.distribution), [course]);

  const gpa = useMemo(() => distributionGpa(course.distribution), [course]);

  const termSeries = useMemo(() => SAMPLE_TERM_GPA[course.code] ?? [], [course]);

  const courseStats = useMemo(
    () =>
      SAMPLE_COURSE_GRADES.map((c) => ({
        code: c.code,
        prefix: c.code.split(" ")[0],
        gpa: distributionGpa(c.distribution) ?? 0,
        total: normalizeGradeVizDistribution(c.distribution)?.total ?? 0,
      })),
    [],
  );

  return (
    <ScreenScaffold title="Trends" subtitle="Grade distributions across the university">
      <View style={styles.pillRow}>
        {SAMPLE_COURSE_GRADES.map((c) => (
          <CoursePill
            key={c.code}
            code={c.code}
            active={c.code === selected}
            onPress={() => setSelected(c.code)}
          />
        ))}
      </View>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="md">
          <View>
            <Title order={4}>{course.code}</Title>
            <Text size="sm" dimmed>
              {course.title}
            </Text>
          </View>

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
        </Stack>
      </Paper>

      {termSeries.length > 0 && (
        <Paper p="md" radius="lg" withBorder>
          <Stack gap="sm">
            <View>
              <Title order={4}>Average grade over time</Title>
              <Text size="sm" dimmed>
                {course.code} · GPA on the 10-point scale, by term
              </Text>
            </View>
            <LineChart data={termSeries.map((p) => ({ label: p.term, value: p.gpa }))} />
          </Stack>
        </Paper>
      )}

      {termSeries.length > 0 && (
        <Paper p="md" radius="lg" withBorder>
          <Stack gap="sm">
            <View>
              <Title order={4}>Grade band</Title>
              <Text size="sm" dimmed>
                {course.code} · cumulative average trend
              </Text>
            </View>
            <AreaChart data={termSeries.map((p) => ({ label: p.term, value: p.gpa }))} />
          </Stack>
        </Paper>
      )}

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="sm">
          <View>
            <Title order={4}>Compare courses</Title>
            <Text size="sm" dimmed>
              Average grade (10-point scale) by course
            </Text>
          </View>
          <BarChart
            data={courseStats.map((s) => ({
              label: s.prefix,
              value: s.gpa,
              color: s.code === selected ? Surface.accent : Surface.border,
            }))}
            maxValue={10}
            formatValue={(v) => v.toFixed(0)}
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="sm">
          <View>
            <Title order={4}>Class size vs average</Title>
            <Text size="sm" dimmed>
              Each point is a course — students enrolled vs GPA
            </Text>
          </View>
          <ScatterChart
            data={courseStats.map((s) => ({
              x: s.total,
              y: s.gpa,
              label: s.prefix,
              color: s.code === selected ? Surface.accent : Surface.dimmed,
            }))}
            yDomain={[4, 9]}
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="sm">
          <View>
            <Title order={4}>Highest average grades</Title>
            <Text size="sm" dimmed>
              Ranked by GPA on uOttawa's 10-point scale — tap a course to chart it.
            </Text>
          </View>
          <GradeLeaderboard
            courses={SAMPLE_COURSE_GRADES}
            selectedCode={selected}
            onSelect={setSelected}
          />
        </Stack>
      </Paper>

      <Text size="xs" dimmed align="center">
        Sample data — live grade trends load once the data layer is wired.
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  pill: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  pillActive: {
    backgroundColor: Surface.accent,
    borderColor: Surface.accent,
  },
  pillLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Surface.label,
  },
  pillLabelActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
});
