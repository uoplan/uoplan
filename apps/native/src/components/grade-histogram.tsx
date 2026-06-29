import { StyleSheet, Text as RNText, View } from "react-native";

import {
  buildGradeHistogramModel,
  GRADE_VIZ_COLORS,
  type GradeVizData,
} from "@uoplan/core/gradeDistribution";

import { Fonts, Spacing, Surface } from "@/constants/theme";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";

const SNS_S_COLOR = Surface.info;
const SNS_NS_COLOR = Surface.warning;
const EMPTY_BAR_COLOR = Surface.translucentStrong;

const LETTER_POINTS: Record<string, number> = {
  F: 0,
  E: 1,
  D: 2,
  "D+": 3,
  C: 4,
  "C+": 5,
  B: 6,
  "B+": 7,
  "A-": 8,
  A: 9,
  "A+": 10,
};

const LETTER_ORDER = ["F", "E", "D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"];

type GradeHistogramDensity = "expanded" | "compact";

interface StatChip {
  label: string;
  value: string;
}

/** Localized-ish label for a histogram display bar (native has no i18n yet). */
function barLabel(key: string, grade: string): string {
  if (key === "DR") return "DR";
  if (key === "FAIL") return "F";
  return grade;
}

function countForGrade(gradeViz: GradeVizData, grade: string): number {
  return gradeViz.histogram.find((entry) => entry.grade === grade)?.count ?? 0;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function numericGradeEntries(gradeViz: GradeVizData): Array<{ grade: string; count: number }> {
  return LETTER_ORDER.map((grade) => ({ grade, count: countForGrade(gradeViz, grade) })).filter(
    (entry) => entry.count > 0,
  );
}

function medianLetterGrade(gradeViz: GradeVizData): string | null {
  const entries = numericGradeEntries(gradeViz);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) return null;

  const midpoint = (total + 1) / 2;
  let seen = 0;
  for (const entry of entries) {
    seen += entry.count;
    if (seen >= midpoint) return entry.grade;
  }
  return entries.at(-1)?.grade ?? null;
}

function nearestLetterGrade(points: number): string | null {
  if (!Number.isFinite(points)) return null;
  let best: { grade: string; diff: number; points: number } | null = null;
  for (const grade of LETTER_ORDER) {
    const gradePoints = LETTER_POINTS[grade];
    const diff = Math.abs(gradePoints - points);
    if (!best || diff < best.diff || (diff === best.diff && gradePoints > best.points)) {
      best = { grade, diff, points: gradePoints };
    }
  }
  return best?.grade ?? null;
}

function averageLetterGrade(gradeViz: GradeVizData): string | null {
  const entries = numericGradeEntries(gradeViz);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) return null;

  const weighted = entries.reduce(
    (sum, entry) => sum + LETTER_POINTS[entry.grade] * entry.count,
    0,
  );
  return nearestLetterGrade(weighted / total);
}

function buildStats(
  gradeViz: GradeVizData,
  showStudentCount: boolean,
  density: GradeHistogramDensity,
): StatChip[] {
  const aPlusCount = countForGrade(gradeViz, "A+");
  const aPlusPercent = gradeViz.gradedTotal > 0 ? (aPlusCount / gradeViz.gradedTotal) * 100 : 0;
  const median = medianLetterGrade(gradeViz);
  const average = averageLetterGrade(gradeViz);

  const stats: StatChip[] = [];
  if (showStudentCount) {
    stats.push({ label: "Students", value: gradeViz.total.toLocaleString() });
  }
  stats.push({ label: "Passing", value: formatPercent(gradeViz.passingPercent) });
  stats.push({ label: "A+", value: formatPercent(aPlusPercent) });
  if (median) stats.push({ label: "Median", value: median });
  if (density === "expanded" && average) stats.push({ label: "Average", value: average });

  return stats;
}

export interface GradeHistogramProps {
  gradeViz: GradeVizData;
  /** Tallest-bar height in px (bars scale against the largest count). */
  maxBarPx?: number;
  /** Show the summary chip row above the chart. */
  showSummary?: boolean;
  /** Include total students in the summary chip row. */
  showStudentCount?: boolean;
  /** Omit the per-bar grade letters (for compact inline histograms). */
  hideLabels?: boolean;
  /** Comfortable detail view or tighter inline accordion rendering. */
  density?: GradeHistogramDensity;
  /** Override the special-bar legend visibility. Defaults to expanded charts only. */
  showLegend?: boolean;
  /**
   * Let the bars flex to fill a narrow container instead of holding their
   * intrinsic minimum width. Used by the compare table, where each histogram
   * must fit inside a thin fixed-width column (otherwise the 12 bars overflow
   * the column and bleed into the neighbour). Opt-in so the full-width compact
   * histograms on the course/professor screens keep their comfortable bar width.
   */
  fitWidth?: boolean;
}

function StatHeader({
  stats,
  compact,
  isTablet,
}: {
  stats: StatChip[];
  compact: boolean;
  isTablet: boolean;
}) {
  if (stats.length === 0) return null;
  const phoneChipStyle =
    stats.length === 4 || stats.length <= 2 ? styles.statChipPhoneHalf : styles.statChipPhoneThird;

  return (
    <View
      style={[
        styles.statsRow,
        isTablet ? styles.statsRowTablet : styles.statsRowPhone,
        compact && styles.statsRowCompact,
      ]}
    >
      {stats.map((stat) => (
        <View
          key={`${stat.label}-${stat.value}`}
          style={[
            styles.statChip,
            isTablet ? styles.statChipTablet : phoneChipStyle,
            compact && styles.statChipCompact,
          ]}
        >
          <RNText style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1}>
            {stat.value}
          </RNText>
          <RNText style={styles.statLabel} numberOfLines={1}>
            {stat.label}
          </RNText>
        </View>
      ))}
    </View>
  );
}

function LegendItem({ label, colors }: { label: string; colors: readonly string[] }) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendSwatch}>
        {colors.map((color) => (
          <View key={color} style={[styles.legendSwatchPart, { backgroundColor: color }]} />
        ))}
      </View>
      <RNText style={styles.legendText}>{label}</RNText>
    </View>
  );
}

/**
 * Vertical grade histogram — renders the shared core model as a spacious native
 * card: summary chips, rounded bars, and a small legend for non-letter grades.
 */
export function GradeHistogram({
  gradeViz,
  maxBarPx = 120,
  showSummary = true,
  showStudentCount = false,
  hideLabels = false,
  density = "expanded",
  showLegend,
  fitWidth = false,
}: GradeHistogramProps) {
  const { isTablet } = useAdaptiveLayout();
  const { sCount, nsCount, snsTotal, displayBars, maxHistogramCount } =
    buildGradeHistogramModel(gradeViz);
  const compact = density === "compact";
  const scaleMax = Math.max(maxHistogramCount, snsTotal, 1);
  const minBarPx = compact ? 5 : 8;
  const barRadius = compact ? 5 : 7;
  const labelRoom = hideLabels ? Spacing.one : compact ? 20 : 24;
  const stats =
    showSummary || showStudentCount ? buildStats(gradeViz, showStudentCount, density) : [];
  const shouldShowLegend = showLegend ?? (!compact && !hideLabels);

  return (
    <View style={styles.wrap}>
      <StatHeader stats={stats} compact={compact} isTablet={isTablet} />

      <View
        style={[
          styles.chartCard,
          stats.length > 0 && styles.chartCardAfterSummary,
          compact && styles.chartCardCompact,
        ]}
      >
        <View
          style={[styles.chart, fitWidth && styles.chartFit, { minHeight: maxBarPx + labelRoom }]}
        >
          {displayBars.map((bar) => {
            const height =
              bar.count > 0 ? Math.max(minBarPx, (bar.count / scaleMax) * maxBarPx) : 0;
            return (
              <View key={bar.key} style={[styles.item, fitWidth && styles.itemFit]}>
                <View style={[styles.barSlot, { height: maxBarPx }]}>
                  {height > 0 ? (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height,
                          borderRadius: barRadius,
                          backgroundColor: GRADE_VIZ_COLORS[bar.bucketId],
                        },
                      ]}
                    />
                  ) : (
                    <View style={[styles.emptyNub, { borderRadius: barRadius }]} />
                  )}
                </View>
                {hideLabels ? null : (
                  <RNText style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
                    {barLabel(bar.key, bar.grade)}
                  </RNText>
                )}
              </View>
            );
          })}

          <View style={[styles.item, styles.snsItem, fitWidth && styles.itemFit]}>
            <View style={[styles.barSlot, { height: maxBarPx }]}>
              {snsTotal > 0 ? (
                <View
                  style={[
                    styles.snsStack,
                    {
                      height: Math.max(minBarPx, (snsTotal / scaleMax) * maxBarPx),
                      borderRadius: barRadius,
                    },
                  ]}
                >
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
                </View>
              ) : (
                <View style={[styles.emptyNub, { borderRadius: barRadius }]} />
              )}
            </View>
            {hideLabels ? null : (
              <RNText style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
                S/NS
              </RNText>
            )}
          </View>
        </View>
      </View>

      {shouldShowLegend ? (
        <View style={styles.legend}>
          <LegendItem label="DR withdrew" colors={[GRADE_VIZ_COLORS.grey]} />
          <LegendItem label="S/NS pass-fail" colors={[SNS_S_COLOR, SNS_NS_COLOR]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  statsRowPhone: {
    flexWrap: "wrap",
  },
  statsRowTablet: {
    flexWrap: "nowrap",
  },
  statsRowCompact: {
    gap: Spacing.one,
  },
  statChip: {
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statChipPhoneHalf: {
    flexBasis: "45%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 76,
  },
  statChipPhoneThird: {
    flexBasis: "30%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 76,
  },
  statChipTablet: {
    flex: 1,
    minWidth: 0,
  },
  statChipCompact: {
    minWidth: 58,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  statValue: {
    color: Surface.label,
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
  },
  statValueCompact: {
    fontSize: 12,
  },
  statLabel: {
    color: Surface.dimmed,
    fontFamily: Fonts.mono,
    fontSize: 10,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  chartCardAfterSummary: {
    marginTop: Spacing.two,
  },
  chartCardCompact: {
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 7,
  },
  chartFit: {
    gap: 3,
  },
  item: {
    flex: 1,
    minWidth: 14,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  itemFit: {
    minWidth: 0,
  },
  snsItem: {
    flex: 1.35,
    minWidth: 18,
  },
  barSlot: {
    width: "100%",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
  },
  emptyNub: {
    width: "100%",
    height: 3,
    backgroundColor: EMPTY_BAR_COLOR,
  },
  snsStack: {
    width: "100%",
    overflow: "hidden",
  },
  label: {
    color: Surface.dimmed,
    fontFamily: Fonts.mono,
    fontSize: 10,
    marginTop: Spacing.two,
    textAlign: "center",
  },
  labelCompact: {
    fontSize: 9,
    marginTop: Spacing.one,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.one,
  },
  legendSwatch: {
    flexDirection: "row",
    height: 8,
    width: 18,
    borderRadius: 999,
    overflow: "hidden",
  },
  legendSwatchPart: {
    flex: 1,
  },
  legendText: {
    color: Surface.dimmed,
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
});
