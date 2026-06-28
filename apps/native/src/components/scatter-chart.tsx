import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { ChartTooltip, useChartScrub } from "@/components/chart-interaction";
import { Fonts, Surface } from "@/constants/theme";

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

  // Nearest point by screen-space (euclidean) distance, so a tap/drag anywhere
  // near a point selects it — scatter has no single axis to bucket along.
  const locate = useCallback(
    (px: number, py: number) => {
      if (data.length === 0 || width === 0) return null;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < data.length; i++) {
        const dx = xFor(data[i].x) - px;
        const dy = yFor(data[i].y) - py;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      return best < 0 ? null : best;
    },
    [data, width, minX, maxX, minY, maxY, plotW, plotH],
  );
  const { active, gesture } = useChartScrub(locate);
  const activeIndex = active != null && active >= 0 && active < data.length ? active : null;
  const activeDatum = activeIndex != null ? data[activeIndex] : null;
  const activeX = activeDatum != null ? xFor(activeDatum.x) : 0;
  const activeY = activeDatum != null ? yFor(activeDatum.y) : 0;

  return (
    <GestureHandlerRootView
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="scatter-chart"
    >
      {width > 0 && (
        <>
          <GestureDetector gesture={gesture}>
            <View collapsable={false}>
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
                    fontFamily={Fonts.mono}
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
                    fontFamily={Fonts.mono}
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
                    fillOpacity={activeIndex != null && activeIndex !== i ? 0.3 : 0.75}
                  />
                ))}
                {activeIndex != null && activeDatum != null && (
                  <Circle
                    cx={activeX}
                    cy={activeY}
                    r={7}
                    fill="none"
                    stroke={activeDatum.color ?? color}
                    strokeWidth={2}
                  />
                )}
              </Svg>
            </View>
          </GestureDetector>
          {activeIndex != null && activeDatum != null && (
            <ChartTooltip
              x={activeX}
              chartWidth={width}
              title={activeDatum.label ?? formatX(activeDatum.x)}
              value={`${formatX(activeDatum.x)} · ${formatY(activeDatum.y)}`}
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
