import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { Surface } from "@/constants/theme";

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface ScatterChartProps {
  data: ScatterPoint[];
  /** Plot height in px (excludes axis labels). Default 180. */
  height?: number;
  /** Explicit width; otherwise measured from the container via onLayout. */
  width?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  color?: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
}

const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const TICKS = 4;

function paddedDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || 1;
  return [lo - pad, hi + pad];
}

/**
 * Scatter chart (react-native-svg) — the native analogue of the web
 * `@mantine/charts` ScatterChart used on the Trends hub (e.g. class-size vs.
 * average-grade). Renders x/y gridlines + tick labels and the points.
 */
export function ScatterChart({
  data,
  height = 180,
  width: widthProp,
  xDomain,
  yDomain,
  color = Surface.accent,
  formatX = (v) => Math.round(v).toString(),
  formatY = (v) => v.toFixed(1),
}: ScatterChartProps) {
  const [measured, setMeasured] = useState(0);
  const width = widthProp ?? measured;

  const [minX, maxX] = useMemo(
    () => xDomain ?? paddedDomain(data.map((d) => d.x)),
    [data, xDomain],
  );
  const [minY, maxY] = useMemo(
    () => yDomain ?? paddedDomain(data.map((d) => d.y)),
    [data, yDomain],
  );

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const totalH = height;

  const xFor = (v: number) =>
    PAD_LEFT + (maxX === minX ? plotW / 2 : ((v - minX) / (maxX - minX)) * plotW);
  const yFor = (v: number) =>
    PAD_TOP + (maxY === minY ? plotH / 2 : (1 - (v - minY) / (maxY - minY)) * plotH);

  const yTicks = useMemo(
    () => Array.from({ length: TICKS + 1 }, (_, i) => minY + ((maxY - minY) * i) / TICKS),
    [minY, maxY],
  );
  const xTicks = useMemo(
    () => Array.from({ length: TICKS + 1 }, (_, i) => minX + ((maxX - minX) * i) / TICKS),
    [minX, maxX],
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="scatter-chart"
    >
      {width > 0 && (
        <Svg width={width} height={totalH}>
          {yTicks.map((t, i) => (
            <Line
              key={`gy${i}`}
              x1={PAD_LEFT}
              y1={yFor(t)}
              x2={width - PAD_RIGHT}
              y2={yFor(t)}
              stroke={Surface.border}
              strokeWidth={1}
            />
          ))}
          {yTicks.map((t, i) => (
            <SvgText
              key={`yl${i}`}
              x={PAD_LEFT - 5}
              y={yFor(t) + 3}
              fontSize={9}
              fill={Surface.dimmed}
              textAnchor="end"
            >
              {formatY(t)}
            </SvgText>
          ))}
          {xTicks.map((t, i) => (
            <SvgText
              key={`xl${i}`}
              x={xFor(t)}
              y={totalH - 6}
              fontSize={9}
              fill={Surface.dimmed}
              textAnchor="middle"
            >
              {formatX(t)}
            </SvgText>
          ))}
          {data.map((d, i) => (
            <Circle
              key={`p${i}`}
              cx={xFor(d.x)}
              cy={yFor(d.y)}
              r={5}
              fill={d.color ?? color}
              fillOpacity={0.75}
            />
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
