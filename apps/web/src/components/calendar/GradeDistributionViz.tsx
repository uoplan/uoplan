import "./gradeDistribution.css";
import { Stack, Text, Tooltip } from "@mantine/core";
import type { GradeVizBucketId, GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import { GRADE_BAND_TOKEN } from "../../lib/trends/palette";

const HIST_DIMS = {
  default: { maxBarPx: 88, snsPx: 88, padTopPx: 20, minWrapHeight: 94, labelFontPx: 10 },
  compact: { maxBarPx: 40, snsPx: 40, padTopPx: 4, minWrapHeight: 52, labelFontPx: 9 },
} as const;

type GradeHistogramVariant = keyof typeof HIST_DIMS;

/** Letter-grade failures merged into the single "Fail" bar (NS is shown via the S/NS bar). */
const FAIL_GRADES = ["F", "E", "ABS", "EIN"] as const;
/** Individual letter bars shown after the combined "Fail" bar (low → high). */
const LETTER_BAR_ORDER = ["D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"] as const;

interface DisplayBar {
  key: string;
  label: string;
  count: number;
  bucketId: GradeVizBucketId;
}

function buildHistogramModel(gradeViz: GradeVizData) {
  const byGrade = new Map(gradeViz.histogram.map((entry) => [entry.grade, entry]));
  const countOf = (grade: string) => byGrade.get(grade)?.count ?? 0;

  const sCount = countOf("S");
  const nsCount = countOf("NS");
  const snsTotal = sCount + nsCount;

  const failCount = FAIL_GRADES.reduce((sum, grade) => sum + countOf(grade), 0);

  const displayBars: DisplayBar[] = [
    { key: "DR", label: tr("calendar.grade.dropLabel"), count: countOf("DR"), bucketId: "grey" },
    { key: "FAIL", label: "F", count: failCount, bucketId: "red" },
    ...LETTER_BAR_ORDER.map(
      (grade): DisplayBar => ({
        key: grade,
        label: grade,
        count: countOf(grade),
        bucketId: byGrade.get(grade)?.bucketId ?? "red",
      }),
    ),
  ];

  const maxHistogramCount = Math.max(...displayBars.map((bar) => bar.count), 1);
  return { sCount, nsCount, snsTotal, displayBars, maxHistogramCount };
}

export function GradeDistributionPassingSummary({
  gradeViz,
  overlay,
  compact,
}: {
  gradeViz: GradeVizData;
  overlay?: boolean;
  compact?: boolean;
}) {
  const aPlusCount = gradeViz.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
  const aPlusPercent =
    gradeViz.gradedTotal > 0 ? Math.round((aPlusCount / gradeViz.gradedTotal) * 100) : 0;
  return (
    <Text
      size={compact ? "xs" : "sm"}
      fw={compact ? 500 : 700}
      c={compact ? "dimmed" : "gray.2"}
      className={overlay ? "cal-grade-passing-overlay" : undefined}
      lh={1.35}
    >
      {tr("calendar.grade.passingAndAPlus", {
        passing: Math.round(gradeViz.passingPercent),
        aPlus: aPlusPercent,
      })}
    </Text>
  );
}

/** Bar heights (%) for the grayed-out "no grade data" placeholder. 12 bars to
 * match the real compact histogram (Withdrew + Fail + 9 letter bars + 1 S/NS bar). */
const HISTOGRAM_PLACEHOLDER_BARS = [34, 30, 52, 78, 64, 44, 58, 70, 48, 62, 38, 56] as const;

/** Grayed-out stand-in shown in place of {@link GradeDistributionHistogram} when
 * a professor / term / section has no grade data. Mirrors the real histogram's
 * markup (same classes, gaps, flex sizing, wider S/NS bar, and label row) so the
 * two line up pixel-for-pixel. */
export function GradeDistributionHistogramPlaceholder({
  variant = "compact",
}: {
  variant?: GradeHistogramVariant;
}) {
  const dims = HIST_DIMS[variant];
  const histClass = [
    "cal-grade-histogram",
    variant === "compact" ? "cal-grade-histogram--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const lastIndex = HISTOGRAM_PLACEHOLDER_BARS.length - 1;
  return (
    <div
      className={histClass}
      style={{ paddingTop: dims.padTopPx, minHeight: dims.minWrapHeight }}
      aria-hidden
    >
      {HISTOGRAM_PLACEHOLDER_BARS.map((h, i) => (
        <div
          key={i}
          className={`cal-grade-histogram-item${
            i === lastIndex ? " cal-grade-histogram-item--sns" : ""
          }`}
        >
          <div
            className="cal-grade-histogram-bar"
            style={{
              height: `${(h / 100) * dims.maxBarPx}px`,
              backgroundColor: "var(--app-translucent-strong)",
            }}
          />
          <Text
            style={{ fontSize: dims.labelFontPx }}
            c="gray.5"
            ta="center"
            className="cal-grade-histogram-label"
          >
            {"\u00A0"}
          </Text>
        </div>
      ))}
    </div>
  );
}

/** Vertical grade histogram (letter buckets + S/NS stack). */
export function GradeDistributionHistogram({
  gradeViz,
  variant = "default",
  hideLabels = false,
  showStudentCount = false,
}: {
  gradeViz: GradeVizData;
  variant?: GradeHistogramVariant;
  /** Omit grade letters under bars (for very narrow inline histograms). */
  hideLabels?: boolean;
  /** Student total above the chart (compact explore histograms). */
  showStudentCount?: boolean;
}) {
  const dims = HIST_DIMS[variant];
  const { sCount, nsCount, snsTotal, displayBars, maxHistogramCount } =
    buildHistogramModel(gradeViz);

  const histClass = [
    "cal-grade-histogram",
    variant === "compact" ? "cal-grade-histogram--compact" : "",
    hideLabels ? "cal-grade-histogram--no-labels" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const minHeight = hideLabels ? dims.maxBarPx + dims.padTopPx + 4 : dims.minWrapHeight;
  const studentCountAbove = showStudentCount && variant === "compact" && gradeViz.total > 0;

  const histogram = (
    <div
      className={histClass}
      style={{
        paddingTop: dims.padTopPx,
        minHeight,
      }}
      aria-hidden
    >
      {displayBars.map((bar) => {
        const percent = gradeViz.total > 0 ? (bar.count / gradeViz.total) * 100 : 0;
        return (
          <Tooltip
            key={bar.key}
            label={tr("calendar.grade.histogramTooltip", {
              grade: bar.label,
              count: bar.count,
              percent: Math.round(percent),
            })}
            withArrow
            position="top"
            withinPortal
          >
            <div className="cal-grade-histogram-item">
              <div
                className="cal-grade-histogram-bar"
                style={{
                  height: `${Math.max(4, (bar.count / maxHistogramCount) * dims.maxBarPx)}px`,
                  backgroundColor:
                    bar.count > 0
                      ? GRADE_BAND_TOKEN[bar.bucketId]
                      : "var(--app-translucent-strong)",
                }}
              />
              {!hideLabels ? (
                <Text
                  style={{ fontSize: dims.labelFontPx }}
                  c="gray.5"
                  ta="center"
                  className="cal-grade-histogram-label"
                >
                  {bar.label}
                </Text>
              ) : null}
            </div>
          </Tooltip>
        );
      })}
      <Tooltip
        label={tr("calendar.grade.snsTooltip", { s: sCount, ns: nsCount })}
        withArrow
        position="top"
        withinPortal
      >
        <div className="cal-grade-histogram-item cal-grade-histogram-item--sns">
          <div
            className="cal-grade-histogram-bar cal-grade-histogram-bar--sns"
            style={{
              height: `${dims.snsPx}px`,
            }}
          >
            {snsTotal > 0 ? (
              <>
                {sCount > 0 && (
                  <span
                    style={{
                      height: `${(sCount / snsTotal) * 100}%`,
                      backgroundColor: "var(--app-info)",
                    }}
                  />
                )}
                {nsCount > 0 && (
                  <span
                    style={{
                      height: `${(nsCount / snsTotal) * 100}%`,
                      backgroundColor: "var(--app-warning)",
                    }}
                  />
                )}
              </>
            ) : (
              <span
                style={{
                  height: "100%",
                  backgroundColor: "var(--app-translucent-strong)",
                }}
              />
            )}
          </div>
          {!hideLabels ? (
            <Text
              style={{ fontSize: dims.labelFontPx }}
              c="gray.5"
              ta="center"
              className="cal-grade-histogram-label"
            >
              {tr("calendar.grade.snsLabel")}
            </Text>
          ) : null}
        </div>
      </Tooltip>
    </div>
  );

  if (!studentCountAbove) return histogram;

  return (
    <Stack gap={4} w="100%">
      <Text size="xs" c="dimmed" className="cal-grade-histogram-count">
        {tr("explore.histogramStudents", { count: gradeViz.total })}
      </Text>
      {histogram}
    </Stack>
  );
}

/** Full-width horizontal strip at the bottom of a calendar event (constant column width). */
export function GradeDistributionBottomBar({ gradeViz }: { gradeViz?: GradeVizData | null }) {
  if (!gradeViz || gradeViz.total <= 0) {
    return <div className="cal-grade-bar cal-grade-bar--empty" aria-hidden />;
  }

  return (
    <div className="cal-grade-bar cal-grade-bar--dist" aria-hidden>
      {gradeViz.buckets.map((bucket) => {
        if (bucket.count <= 0) return null;
        return (
          <span
            key={bucket.id}
            style={{
              width: `${(bucket.count / gradeViz.total) * 100}%`,
              backgroundColor: GRADE_BAND_TOKEN[bucket.id],
            }}
          />
        );
      })}
    </div>
  );
}

export function GradeDistributionExpanded({ gradeViz }: { gradeViz?: GradeVizData | null }) {
  if (!gradeViz || gradeViz.total <= 0) return null;

  return (
    <Stack gap={8}>
      <div className="cal-grade-expanded">
        <div className="cal-grade-histogram-wrap">
          <GradeDistributionPassingSummary gradeViz={gradeViz} overlay />
          <GradeDistributionHistogram gradeViz={gradeViz} variant="default" />
        </div>
      </div>
    </Stack>
  );
}
