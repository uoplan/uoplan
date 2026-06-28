import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { ChartTooltip, useChartScrub } from "@/components/chart-interaction";
import { Fonts, Surface } from "@/constants/theme";

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** Plot height in px (excludes axis labels). Default 160. */
  height?: number;
  /** Explicit width; otherwise measured from the container via onLayout. */
  width?: number;
  /** Y-axis max. Defaults to a padded max of the data. */
  maxValue?: number;
  color?: string;
  formatValue?: (v: number) => string;
  /** Format a value for the scrub tooltip. Defaults to 1 decimal. */
  formatTooltipValue?: (v: number) => string;
}

const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
const Y_TICKS = 4;

/**
 * Vertical bar chart (react-native-svg) — the native analogue of the web
 * `@mantine/charts` BarChart used on the Trends hub (discipline / level / season
 * / metric comparisons). Renders y gridlines + tick labels, category bars, and
 * x-axis category labels.
 */
export function BarChart({
  data,
  height = 160,
  width: widthProp,
  maxValue,
  color = Surface.accent,
  formatValue = (v) => v.toFixed(1),
  formatTooltipValue = (v) => v.toFixed(1),
}: BarChartProps) {
  const [measured, setMeasured] = useState(0);
  const width = widthProp ?? measured;

  const maxY = useMemo(() => {
    if (maxValue != null) return maxValue;
    if (data.length === 0) return 1;
    const hi = Math.max(...data.map((d) => d.value));
    return hi * 1.1 || 1;
  }, [data, maxValue]);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const totalH = height;

  const slot = data.length > 0 ? plotW / data.length : 0;
  const barW = slot * 0.6;

  const yFor = (v: number) => PAD_TOP + (1 - v / maxY) * plotH;

  const ticks = useMemo(
    () => Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxY * i) / Y_TICKS),
    [maxY],
  );

  const locate = useCallback(
    (x: number) => {
      if (data.length === 0 || slot <= 0) return null;
      const idx = Math.floor((x - PAD_LEFT) / slot);
      return Math.max(0, Math.min(data.length - 1, idx));
    },
    [data.length, slot],
  );
  const { active, gesture } = useChartScrub(locate);
  const activeIndex = active != null && active >= 0 && active < data.length ? active : null;
  const activeDatum = activeIndex != null ? data[activeIndex] : null;
  const activeCursorX = activeIndex != null ? PAD_LEFT + activeIndex * slot + slot / 2 : 0;

  return (
    <GestureHandlerRootView
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="bar-chart"
    >
      {width > 0 && (
        <>
          <GestureDetector gesture={gesture}>
            <View collapsable={false}>
              <Svg width={width} height={totalH}>
                {ticks.map((t, i) => (
                  <Line
                    key={`g${i}`}
                    x1={PAD_LEFT}
                    y1={yFor(t)}
                    x2={width - PAD_RIGHT}
                    y2={yFor(t)}
                    stroke={Surface.border}
                    strokeWidth={1}
                  />
                ))}
                {ticks.map((t, i) => (
                  <SvgText
                    key={`tl${i}`}
                    x={PAD_LEFT - 5}
                    y={yFor(t) + 3}
                    fontFamily={Fonts.mono}
                    fontSize={9}
                    fill={Surface.dimmed}
                    textAnchor="end"
                  >
                    {formatValue(t)}
                  </SvgText>
                ))}
                {data.map((d, i) => {
                  const x = PAD_LEFT + i * slot + (slot - barW) / 2;
                  const y = yFor(d.value);
                  return (
                    <Rect
                      key={`b${i}`}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0, PAD_TOP + plotH - y)}
                      rx={3}
                      fill={d.color ?? color}
                      fillOpacity={activeIndex == null || activeIndex === i ? 1 : 0.4}
                    />
                  );
                })}
                {data.map((d, i) => (
                  <SvgText
                    key={`xl${i}`}
                    x={PAD_LEFT + i * slot + slot / 2}
                    y={totalH - 8}
                    fontFamily={Fonts.mono}
                    fontSize={9}
                    fill={Surface.dimmed}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                ))}
                {activeIndex != null && activeDatum != null && (
                  <Line
                    x1={activeCursorX}
                    y1={PAD_TOP}
                    x2={activeCursorX}
                    y2={PAD_TOP + plotH}
                    stroke={Surface.accent}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
              </Svg>
            </View>
          </GestureDetector>
          {activeIndex != null && activeDatum != null && (
            <ChartTooltip
              x={activeCursorX}
              chartWidth={width}
              title={activeDatum.label}
              value={formatTooltipValue(activeDatum.value)}
            />
          )}
        </>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
});
