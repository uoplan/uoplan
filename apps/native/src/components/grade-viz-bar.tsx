import { StyleSheet, Text as RNText, View } from "react-native";

import type { GradeVizData } from "@uoplan/core/gradeDistribution";

import { Fonts, Spacing, Surface } from "@/constants/theme";

export interface GradeVizBarProps {
  gradeViz?: GradeVizData | null;
  /** Inner stacked-bar height in px. */
  height?: number;
  /** Flush card-edge variant: full-width footer shelf, preserving card overflow rounding. */
  flush?: boolean;
  /**
   * For the {@link flush} variant: round the strip's BOTTOM corners to this
   * radius so the colored fill follows the host card's rounded bottom edge
   * (pass the card's `borderRadius`). Without it the square corners can poke
   * past the curve because RN's `overflow: hidden` corner-clipping is imperfect
   * on Android. Top corners stay square (the strip sits mid-card). Defaults to
   * square (no rounding).
   */
  bottomRadius?: number;
  /** Render a tiny one-line stat beside the bar for dense list rows. */
  showInlineStat?: boolean;
}

function formatInlineStat(gradeViz: GradeVizData | null | undefined): string {
  if (!gradeViz || gradeViz.total <= 0) return "No grade data";
  return `${Math.round(gradeViz.passingPercent)}% passing`;
}

function StackedTrack({
  gradeViz,
  height,
  edgeToEdge = false,
  bottomRadius,
}: {
  gradeViz?: GradeVizData | null;
  height: number;
  edgeToEdge?: boolean;
  bottomRadius?: number;
}) {
  const radius = edgeToEdge ? 0 : Math.max(2, height / 2);
  // For the flush footer, round only the bottom corners so the colored fill
  // hugs the host card's rounded bottom edge instead of poking past the curve.
  const cornerStyle =
    bottomRadius != null
      ? { borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius }
      : { borderRadius: radius };
  const hasData = !!gradeViz && gradeViz.total > 0;

  return (
    <View style={[styles.track, { height }, cornerStyle]} accessibilityElementsHidden>
      {hasData
        ? gradeViz.buckets.map((bucket) =>
            bucket.count <= 0 ? null : (
              <View
                key={bucket.id}
                style={[styles.segment, { flexGrow: bucket.count, backgroundColor: bucket.color }]}
              />
            ),
          )
        : null}
    </View>
  );
}

/**
 * Compact horizontal stacked grade-distribution bar. The distribution sits inside
 * a faint track, so even a tiny explore-card footer reads like an intentional
 * data rail instead of a stray line.
 */
export function GradeVizBar({
  gradeViz,
  height = 6,
  flush = false,
  bottomRadius,
  showInlineStat = false,
}: GradeVizBarProps) {
  if (showInlineStat) {
    const track = <StackedTrack gradeViz={gradeViz} height={height} />;

    return (
      <View style={[styles.inlineWrap, flush && styles.flushInlineWrap]}>
        <RNText style={styles.inlineStat} numberOfLines={1}>
          {formatInlineStat(gradeViz)}
        </RNText>
        <View style={styles.inlineTrack}>{track}</View>
      </View>
    );
  }

  if (flush) {
    const track = (
      <StackedTrack gradeViz={gradeViz} height={height} edgeToEdge bottomRadius={bottomRadius} />
    );

    return <View style={styles.flushWrap}>{track}</View>;
  }

  const track = <StackedTrack gradeViz={gradeViz} height={height} />;

  return track;
}

const styles = StyleSheet.create({
  flushWrap: {
    backgroundColor: "transparent",
    width: "100%",
  },
  inlineWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    width: "100%",
  },
  flushInlineWrap: {
    backgroundColor: "transparent",
  },
  inlineStat: {
    color: Surface.dimmed,
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  inlineTrack: {
    flex: 1,
    minWidth: 32,
  },
  segment: {
    flexBasis: 0,
    minWidth: 1,
  },
  track: {
    backgroundColor: Surface.translucentStrong,
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
});
