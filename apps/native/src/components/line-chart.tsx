import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { Fonts, Surface } from "@/constants/theme";

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  /** Fixed plot height in px (excludes axis labels). Default 140. */
  height?: number;
  /** Explicit width. When omitted the chart measures its container via onLayout. */
  width?: number;
  /** Y-axis domain. Defaults to a padded [min, max] of the data. */
  domain?: [number, number];
  color?: string;
  /** Format a y value for the axis labels. Default: 1 decimal. */
  formatValue?: (v: number) => string;
}

const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const Y_TICKS = 4;

/**
 * Minimal SVG line chart (react-native-svg) — the native analogue of the web
 * `@mantine/charts` LineChart used on Trends/feedback. Renders y gridlines + tick
 * labels, the value line, dots, and x-axis category labels. Width is measured
 * from the container so it fills the card.
 */
export function LineChart({
  data,
  height = 140,
  width: widthProp,
  domain,
  color = Surface.accent,
  formatValue = (v) => v.toFixed(1),
}: LineChartProps) {
  const [measured, setMeasured] = useState(0);
  const width = widthProp ?? measured;

  const [minY, maxY] = useMemo<[number, number]>(() => {
    if (domain) return domain;
    if (data.length === 0) return [0, 1];
    const values = data.map((d) => d.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.2 || 1;
    return [Math.max(0, lo - pad), hi + pad];
  }, [data, domain]);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const totalH = height;

  const xFor = (i: number) =>
    PAD_LEFT + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yFor = (v: number) =>
    PAD_TOP + (maxY === minY ? plotH / 2 : (1 - (v - minY) / (maxY - minY)) * plotH);

  const linePath = useMemo(() => {
    if (data.length === 0 || width === 0) return "";
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(d.value).toFixed(2)}`)
      .join(" ");
  }, [data, width, minY, maxY, plotW, plotH]);

  const ticks = useMemo(
    () => Array.from({ length: Y_TICKS + 1 }, (_, i) => minY + ((maxY - minY) * i) / Y_TICKS),
    [minY, maxY],
  );

  // Thin the x-axis labels so they never overlap: estimate how many fit across
  // the plot (≈34px per label) and only draw every Nth (always keeping the last).
  const labelStride = useMemo(() => {
    if (data.length <= 1 || plotW <= 0) return 1;
    const maxLabels = Math.max(1, Math.floor(plotW / 34));
    return Math.ceil(data.length / maxLabels);
  }, [data.length, plotW]);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="line-chart"
    >
      {width > 0 && (
        <Svg width={width} height={totalH}>
          {ticks.map((t, i) => {
            const y = yFor(t);
            return (
              <Line
                key={`g${i}`}
                x1={PAD_LEFT}
                y1={y}
                x2={width - PAD_RIGHT}
                y2={y}
                stroke={Surface.border}
                strokeWidth={1}
              />
            );
          })}
          {ticks.map((t, i) => (
            <SvgText
              key={`t${i}`}
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
            // Only render labels at the computed stride (plus the final one) so
            // dense term axes (17+ terms) don't overlap into an unreadable smear.
            const show = i % labelStride === 0 || i === data.length - 1;
            if (!show) return null;
            return (
              <SvgText
                key={`x${i}`}
                x={xFor(i)}
                y={totalH - 6}
                fontFamily={Fonts.mono}
                fontSize={9}
                fill={Surface.dimmed}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            );
          })}
          {linePath !== "" && <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />}
          {data.map((d, i) => (
            <Circle key={`c${i}`} cx={xFor(i)} cy={yFor(d.value)} r={3} fill={color} />
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
