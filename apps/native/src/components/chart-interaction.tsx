import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";

import { Fonts, Surface } from "@/constants/theme";

/**
 * Shared touch-scrub interaction for the SVG trend charts. Maps a local touch
 * x/y to the nearest datum index via `locate`, so tapping shows that point's
 * value and holding + dragging scrubs across the series — mirroring the web
 * charts' hover tooltip.
 *
 * A horizontal-biased Pan (with a vertical fail threshold) lets the parent
 * vertical ScrollView keep scrolling, while a Tap handles discrete taps. Both
 * run on the JS thread (`runOnJS`) so they can drive React state directly,
 * matching the gesture pattern used by the week calendar.
 */
export function useChartScrub(locate: (x: number, y: number) => number | null) {
  const [active, setActive] = useState<number | null>(null);

  const gesture = useMemo(() => {
    const apply = (x: number, y: number) => setActive(locate(x, y));
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => apply(e.x, e.y))
      .onUpdate((e) => apply(e.x, e.y));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onStart((e) => apply(e.x, e.y));
    // Exclusive: the Pan only activates on a dominant horizontal drag, so a
    // stationary press falls through to the Tap (and a vertical drag fails both,
    // yielding to the scroll view).
    return Gesture.Exclusive(pan, tap);
  }, [locate]);

  return { active, gesture };
}

export interface ChartTooltipProps {
  /** Anchor x in chart coordinates (the cursor position). */
  x: number;
  /** Total chart width, used to clamp the bubble within the plot. */
  chartWidth: number;
  /** Top line — the category / point label. */
  title: string;
  /** Bottom line — the formatted value. */
  value: string;
}

/**
 * Floating value bubble shown at the active point while scrubbing/tapping. It is
 * centred over `x` and clamped to stay within the chart. An inverted palette
 * (page text on the primary-text colour) keeps it legible in light and dark.
 */
export function ChartTooltip({ x, chartWidth, title, value }: ChartTooltipProps) {
  const [measured, setMeasured] = useState(96);
  const left = Math.max(4, Math.min(x - measured / 2, Math.max(4, chartWidth - measured - 4)));
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={[styles.tooltip, { left }]}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute",
    top: 2,
    maxWidth: 220,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Surface.label,
    gap: 1,
  },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Surface.page,
    opacity: 0.75,
  },
  value: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.page,
  },
});
