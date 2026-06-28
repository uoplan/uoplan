import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { ChartTooltip, useChartScrub } from "@/components/chart-interaction";
import { Fonts, Surface } from "@/constants/theme";

export interface AreaChartPoint {
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaChartPoint[];
  /** Plot height in px (excludes axis labels). Default 140. */
  height?: number;
  /** Explicit width; otherwise measured from the container via onLayout. */
  width?: number;
  domain?: [number, number];
  color?: string;
  formatValue?: (v: number) => string;
  /** Format a value for the scrub tooltip. Defaults to the axis formatter. */
  formatTooltipValue?: (v: number) => string;
}

const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const Y_TICKS = 3;

/**
 * Area chart (react-native-svg) — the native analogue of the web
 * `@mantine/charts` AreaChart (e.g. the Trends grade-band area). Renders a
 * gradient-filled area under the value line plus y/x axis labels.
 */
export function AreaChart({
  data,
  height = 140,
  width: widthProp,
  domain,
  color = Surface.accent,
  formatValue = (v) => v.toFixed(1),
  formatTooltipValue,
}: AreaChartProps) {
  const [measured, setMeasured] = useState(0);
  const width = widthProp ?? measured;

  const [minY, maxY] = useMemo<[number, number]>(() => {
    if (domain) return domain;
    if (data.length === 0) return [0, 1];
    const values = data.map((d) => d.value);
    const lo = Math.min(...values, 0);
    const hi = Math.max(...values);
    return [lo, hi * 1.1 || 1];
  }, [data, domain]);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const totalH = height;
  const baseY = PAD_TOP + plotH;

  const xFor = (i: number) =>
    PAD_LEFT + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yFor = (v: number) =>
    PAD_TOP + (maxY === minY ? plotH / 2 : (1 - (v - minY) / (maxY - minY)) * plotH);

  const { linePath, areaPath } = useMemo(() => {
    if (data.length === 0 || width === 0) return { linePath: "", areaPath: "" };
    const line = data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(d.value).toFixed(2)}`)
      .join(" ");
    const area = `${line} L ${xFor(data.length - 1).toFixed(2)} ${baseY.toFixed(2)} L ${xFor(0).toFixed(2)} ${baseY.toFixed(2)} Z`;
    return { linePath: line, areaPath: area };
  }, [data, width, minY, maxY, plotW, plotH, baseY]);

  const ticks = useMemo(
    () => Array.from({ length: Y_TICKS + 1 }, (_, i) => minY + ((maxY - minY) * i) / Y_TICKS),
    [minY, maxY],
  );

  // Thin the x-axis labels so dense term axes don't overlap (≈34px per label).
  const labelStride = useMemo(() => {
    if (data.length <= 1 || plotW <= 0) return 1;
    const maxLabels = Math.max(1, Math.floor(plotW / 34));
    return Math.ceil(data.length / maxLabels);
  }, [data.length, plotW]);

  const locate = useCallback(
    (x: number) => {
      if (data.length === 0) return null;
      if (data.length === 1) return 0;
      if (plotW <= 0) return null;
      const idx = Math.round(((x - PAD_LEFT) / plotW) * (data.length - 1));
      return Math.max(0, Math.min(data.length - 1, idx));
    },
    [data.length, plotW],
  );
  const { active, gesture } = useChartScrub(locate);
  const activeIndex = active != null && active >= 0 && active < data.length ? active : null;
  const activeDatum = activeIndex != null ? data[activeIndex] : null;
  const activeX = activeIndex != null ? xFor(activeIndex) : 0;
  const tooltipFmt = formatTooltipValue ?? formatValue;

  return (
    <GestureHandlerRootView
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="area-chart"
    >
      {width > 0 && (
        <>
          <GestureDetector gesture={gesture}>
            <View collapsable={false}>
              <Svg width={width} height={totalH}>
                <Defs>
                  <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.35} />
                    <Stop offset="1" stopColor={color} stopOpacity={0.02} />
                  </LinearGradient>
                </Defs>
                {ticks.map((t, i) => (
                  <SvgText
                    key={`yl${i}`}
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
                  const show = i % labelStride === 0 || i === data.length - 1;
                  if (!show) return null;
                  return (
                    <SvgText
                      key={`xl${i}`}
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
                {areaPath !== "" && <Path d={areaPath} fill="url(#areaFill)" />}
                {linePath !== "" && (
                  <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
                )}
                {activeIndex != null && (
                  <Line
                    x1={activeX}
                    y1={PAD_TOP}
                    x2={activeX}
                    y2={PAD_TOP + plotH}
                    stroke={Surface.accent}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
                {activeIndex != null && activeDatum != null && (
                  <Circle
                    cx={activeX}
                    cy={yFor(activeDatum.value)}
                    r={5}
                    fill={color}
                    stroke={Surface.page}
                    strokeWidth={1.5}
                  />
                )}
              </Svg>
            </View>
          </GestureDetector>
          {activeIndex != null && activeDatum != null && (
            <ChartTooltip
              x={activeX}
              chartWidth={width}
              title={activeDatum.label}
              value={tooltipFmt(activeDatum.value)}
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
