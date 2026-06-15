import { StyleSheet, View } from "react-native";

import type { GradeVizData } from "@uoplan/core/gradeDistribution";

import { Surface } from "@/constants/theme";

/**
 * Compact horizontal stacked grade-distribution bar — the native leaf of the web
 * `GradeDistributionBottomBar`. Each of the seven grade-viz buckets becomes a
 * proportional segment (`flexGrow` = count, matching the web's width-% split)
 * tinted with its bucket colour. Empty distributions render a faint placeholder.
 */
export function GradeVizBar({
  gradeViz,
  height = 6,
  flush = false,
}: {
  gradeViz?: GradeVizData | null;
  height?: number;
  /** Flush card-edge variant: square corners (the card's overflow rounds them). */
  flush?: boolean;
}) {
  const radius = flush ? 0 : 999;
  if (!gradeViz || gradeViz.total <= 0) {
    return (
      <View
        style={[styles.bar, styles.empty, { height, borderRadius: radius }]}
        accessibilityElementsHidden
      />
    );
  }
  return (
    <View style={[styles.bar, { height, borderRadius: radius }]} accessibilityElementsHidden>
      {gradeViz.buckets.map((bucket) =>
        bucket.count <= 0 ? null : (
          <View key={bucket.id} style={{ flexGrow: bucket.count, backgroundColor: bucket.color }} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    width: "100%",
    overflow: "hidden",
  },
  empty: {
    backgroundColor: Surface.border,
  },
});
