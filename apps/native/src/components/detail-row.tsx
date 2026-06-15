import { Pressable, StyleSheet, View } from "react-native";

import type { GradeVizData } from "@uoplan/core/gradeDistribution";
import { Text } from "@uoplan/ui";

import { GradeVizBar } from "@/components/grade-viz-bar";
import { Spacing, Surface } from "@/constants/theme";

interface DetailRowProps {
  /** Primary label (course code, professor name, discipline code…). */
  title: string;
  /** Secondary muted label under the title (course title, discipline name…). */
  subtitle?: string;
  /** Trailing aligned stat (e.g. "8.2 avg", "1,204 grades"). */
  meta?: string;
  /** Optional grade-distribution bar drawn across the bottom of the row. */
  gradeViz?: GradeVizData | null;
  onPress?: () => void;
}

/**
 * A compact related-entity row used by the Explore detail screens: a leading
 * title + muted subtitle, an optional trailing stat, and an optional
 * grade-distribution bar — the native analogue of the web detail-page list rows.
 */
export function DetailRow({ title, subtitle, meta, gradeViz, onPress }: DetailRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={styles.row}
    >
      <View style={styles.head}>
        <View style={styles.text}>
          <Text size="sm" weight="bold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="sm" dimmed numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {meta ? (
          <Text size="sm" color={Surface.label}>
            {meta}
          </Text>
        ) : null}
      </View>
      {gradeViz ? <GradeVizBar gradeViz={gradeViz} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
