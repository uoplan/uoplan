import { StyleSheet, Text as RNText, View } from "react-native";

import {
  buildGradeHistogramModel,
  GRADE_VIZ_COLORS,
  type GradeVizData,
} from "@uoplan/core/gradeDistribution";

import { Surface } from "@/constants/theme";

/**
 * S/NS stacked-bar tones, approximating the web `--app-info` / `--app-warning`
 * tokens (oklch) as static hex for React Native.
 */
const SNS_S_COLOR = "#5fa8cf";
const SNS_NS_COLOR = "#d49a55";
const EMPTY_BAR_COLOR = "#e7e1d6";

/** Localized-ish label for a histogram display bar (native has no i18n yet). */
function barLabel(key: string, grade: string): string {
  if (key === "DR") return "DR";
  if (key === "FAIL") return "F";
  return grade;
}

export interface GradeHistogramProps {
  gradeViz: GradeVizData;
  /** Tallest-bar height in px (bars scale against the largest count). */
  maxBarPx?: number;
  /** Show the "X% passing · Y% A+" summary line above the chart. */
  showSummary?: boolean;
  /** Show the total-students caption above the chart. */
  showStudentCount?: boolean;
  /** Omit the per-bar grade letters (for compact inline histograms). */
  hideLabels?: boolean;
}

/**
 * Vertical grade histogram — the native leaf of the web
 * `GradeDistributionHistogram`. Both platforms render the same shared model
 * (`buildGradeHistogramModel` from `@uoplan/core`) with the same bucket colours
 * (`GRADE_VIZ_COLORS`): a Withdrew (DR) bar, a merged Fail bar, nine letter bars
 * (D → A+), and a trailing stacked S/NS bar.
 */
export function GradeHistogram({
  gradeViz,
  maxBarPx = 104,
  showSummary = true,
  showStudentCount = false,
  hideLabels = false,
}: GradeHistogramProps) {
  const { sCount, nsCount, snsTotal, displayBars, maxHistogramCount } =
    buildGradeHistogramModel(gradeViz);

  const aPlusCount = gradeViz.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
  const aPlusPercent =
    gradeViz.gradedTotal > 0 ? Math.round((aPlusCount / gradeViz.gradedTotal) * 100) : 0;

  return (
    <View style={styles.wrap}>
      {showStudentCount && gradeViz.total > 0 ? (
        <RNText style={styles.caption}>{gradeViz.total.toLocaleString()} students</RNText>
      ) : null}
      {showSummary ? (
        <RNText style={styles.summary}>
          {Math.round(gradeViz.passingPercent)}% passing · {aPlusPercent}% A+
        </RNText>
      ) : null}

      <View style={[styles.chart, { minHeight: maxBarPx + (hideLabels ? 4 : 24) }]}>
        {displayBars.map((bar) => {
          const height = Math.max(4, (bar.count / maxHistogramCount) * maxBarPx);
          return (
            <View key={bar.key} style={styles.item}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor:
                      bar.count > 0 ? GRADE_VIZ_COLORS[bar.bucketId] : EMPTY_BAR_COLOR,
                  },
                ]}
              />
              {hideLabels ? null : (
                <RNText style={styles.label} numberOfLines={1}>
                  {barLabel(bar.key, bar.grade)}
                </RNText>
              )}
            </View>
          );
        })}

        <View style={[styles.item, styles.snsItem]}>
          <View style={[styles.bar, styles.snsBar, { height: maxBarPx }]}>
            {snsTotal > 0 ? (
              <>
                {sCount > 0 ? (
                  <View
                    style={{
                      height: `${(sCount / snsTotal) * 100}%`,
                      backgroundColor: SNS_S_COLOR,
                    }}
                  />
                ) : null}
                {nsCount > 0 ? (
                  <View
                    style={{
                      height: `${(nsCount / snsTotal) * 100}%`,
                      backgroundColor: SNS_NS_COLOR,
                    }}
                  />
                ) : null}
              </>
            ) : (
              <View style={styles.snsEmpty} />
            )}
          </View>
          {hideLabels ? null : (
            <RNText style={styles.label} numberOfLines={1}>
              S/NS
            </RNText>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 8,
  },
  caption: {
    fontSize: 12,
    color: Surface.dimmed,
  },
  summary: {
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  snsItem: {
    flex: 1.4,
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },
  snsBar: {
    flexDirection: "column",
    overflow: "hidden",
  },
  snsEmpty: {
    height: "100%",
    backgroundColor: EMPTY_BAR_COLOR,
  },
  label: {
    fontSize: 10,
    color: Surface.dimmed,
    textAlign: "center",
    marginTop: 4,
  },
});
