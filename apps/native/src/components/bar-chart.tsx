import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

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

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="bar-chart"
    >
      {width > 0 && (
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
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
});
