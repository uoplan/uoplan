import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { distributionGpa } from "@uoplan/core/gradeDistribution";

import { Fonts, GradeBandColor, Surface } from "@/constants/theme";

interface LeaderboardCourse {
  code: string;
  title: string;
  distribution: Record<string, number>;
}

export interface GradeLeaderboardProps {
  courses: LeaderboardCourse[];
  selectedCode?: string;
  onSelect?: (code: string) => void;
}

interface RankedCourse {
  code: string;
  title: string;
  gpa: number;
}

/** GPA is on uOttawa's 10-point scale; colour each bar by tier (theme tokens). */
function barColor(gpa: number): string {
  if (gpa >= 8) return GradeBandColor.green;
  if (gpa >= 7) return GradeBandColor.blue;
  if (gpa >= 6) return GradeBandColor.amber;
  return GradeBandColor.red;
}

/**
 * Ranked "highest average grades" list — the native analogue of the web Trends
 * leaderboard. Reuses the shared `distributionGpa` (10-point scale) and renders
 * each course as a horizontal RN-View bar (no SVG). Rows are pressable so they
 * can drive the histogram above.
 */
export function GradeLeaderboard({ courses, selectedCode, onSelect }: GradeLeaderboardProps) {
  const ranked = useMemo<RankedCourse[]>(() => {
    return courses
      .map((c) => ({ code: c.code, title: c.title, gpa: distributionGpa(c.distribution) ?? 0 }))
      .filter((c) => c.gpa > 0)
      .sort((a, b) => b.gpa - a.gpa);
  }, [courses]);

  return (
    <View style={styles.list}>
      {ranked.map((course, index) => {
        const active = course.code === selectedCode;
        const widthPct = Math.max(8, Math.min(100, (course.gpa / 10) * 100));
        return (
          <Pressable
            key={course.code}
            onPress={() => onSelect?.(course.code)}
            style={[styles.row, active && styles.rowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.body}>
              <View style={styles.rowHeader}>
                <Text style={styles.code} numberOfLines={1}>
                  {course.code}
                </Text>
                <Text style={styles.gpa}>{course.gpa.toFixed(2)}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { width: `${widthPct}%`, backgroundColor: barColor(course.gpa) },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowActive: {
    backgroundColor: Surface.subtle,
  },
  rank: {
    width: 18,
    textAlign: "center",
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  code: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "600",
    color: Surface.label,
  },
  gpa: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Surface.border,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
});
