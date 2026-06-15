import { StyleSheet, View } from "react-native";

import type { DisciplineHeatmap } from "@uoplan/core/gradeAnalytics";
import { Text } from "@uoplan/ui";

import { Spacing, Surface } from "@/constants/theme";

const LABEL_W = 52;
const CELL_H = 20;

/** Red→amber→green colour for a value within [min,max] (mirrors web cellColor). */
function cellColor(value: number | null, min: number, max: number): string {
  if (value == null) return Surface.translucentStrong;
  const span = max - min;
  const t = span > 0 ? Math.max(0, Math.min(1, (value - min) / span)) : 0.5;
  return `hsl(${Math.round(t * 130)}, 58%, 46%)`;
}

const LEGEND_STOPS = [0, 0.25, 0.5, 0.75, 1].map((t) => `hsl(${Math.round(t * 130)}, 58%, 46%)`);

/** [min, max] of all non-null cell values across the heatmap. */
function valueRange(heatmap: DisciplineHeatmap): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of heatmap.rows) {
    for (const cell of row.cells) {
      if (cell.value == null) continue;
      lo = Math.min(lo, cell.value);
      hi = Math.max(hi, cell.value);
    }
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 1];
}

/**
 * Discipline × year matrix of average GPA — the native leaf of the web
 * `DisciplineHeatmapCard`. Each row is a discipline; each cell a year, tinted
 * red (low) → green (high). Cells with too little data render muted/empty.
 */
export function DisciplineHeatmapChart({ heatmap }: { heatmap: DisciplineHeatmap }) {
  if (heatmap.rows.length === 0) {
    return (
      <Text size="sm" dimmed>
        Not enough data yet.
      </Text>
    );
  }

  const [min, max] = valueRange(heatmap);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.labelCol} />
        {heatmap.years.map((year) => (
          <View key={year} style={styles.cellSlot}>
            <Text size="xs" color={Surface.dimmed}>
              {String(year).slice(2)}
            </Text>
          </View>
        ))}
      </View>

      {heatmap.rows.map((row) => (
        <View key={row.discipline} style={styles.row}>
          <View style={styles.labelCol}>
            <Text size="xs" weight="bold" numberOfLines={1} color={Surface.label}>
              {row.discipline}
            </Text>
          </View>
          {row.cells.map((cell) => (
            <View key={cell.year} style={styles.cellSlot}>
              <View style={[styles.cell, { backgroundColor: cellColor(cell.value, min, max) }]} />
            </View>
          ))}
        </View>
      ))}

      <View style={styles.legend}>
        <Text size="xs" color={Surface.dimmed}>
          Lower
        </Text>
        <View style={styles.legendBars}>
          {LEGEND_STOPS.map((color, i) => (
            <View key={i} style={[styles.legendBar, { backgroundColor: color }]} />
          ))}
        </View>
        <Text size="xs" color={Surface.dimmed}>
          Higher
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  labelCol: {
    width: LABEL_W,
    justifyContent: "center",
  },
  cellSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    width: "100%",
    height: CELL_H,
    borderRadius: 3,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  legendBars: {
    flexDirection: "row",
    width: 96,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  legendBar: {
    flex: 1,
    height: "100%",
  },
});
