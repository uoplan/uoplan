import "./gradeDistribution.css";
import { Stack, Text, Tooltip } from "@mantine/core";
import type { GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";

const HIST_DIMS = {
  default: { maxBarPx: 88, snsPx: 88, padTopPx: 20, minWrapHeight: 94, labelFontPx: 10 },
  compact: { maxBarPx: 40, snsPx: 40, padTopPx: 4, minWrapHeight: 52, labelFontPx: 9 },
} as const;

type GradeHistogramVariant = keyof typeof HIST_DIMS;

function buildHistogramModel(gradeViz: GradeVizData) {
  const sCount = gradeViz.histogram.find((entry) => entry.grade === "S")?.count ?? 0;
  const nsCount = gradeViz.histogram.find((entry) => entry.grade === "NS")?.count ?? 0;
  const snsTotal = sCount + nsCount;
  const histogramEntries = gradeViz.histogram.filter(
    (entry) => entry.grade !== "P" && entry.grade !== "S",
  );
  const maxHistogramCount = Math.max(...histogramEntries.map((h) => h.count), 1);
  return { sCount, nsCount, snsTotal, histogramEntries, maxHistogramCount };
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
  const aPlusPercent = Math.round((aPlusCount / gradeViz.total) * 100);
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

/** Bar heights (%) for the grayed-out "no grade data" placeholder. 15 bars to
 * match the real compact histogram (14 grade letters + 1 S/NS bar). */
const HISTOGRAM_PLACEHOLDER_BARS = [
  30, 52, 78, 64, 44, 28, 40, 58, 70, 48, 34, 62, 50, 38, 56,
] as const;

/** Grayed-out stand-in shown in place of {@link GradeDistributionHistogram} when
 * a professor / term / section has no grade data. */
export function GradeDistributionHistogramPlaceholder({
  variant = "compact",
}: {
  variant?: GradeHistogramVariant;
}) {
  const dims = HIST_DIMS[variant];
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        width: "100%",
        height: dims.minWrapHeight,
      }}
    >
      {HISTOGRAM_PLACEHOLDER_BARS.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            backgroundColor: "var(--app-translucent-strong)",
            borderRadius: 2,
          }}
        />
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
  const { sCount, nsCount, snsTotal, histogramEntries, maxHistogramCount } =
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
      {histogramEntries.map((entry) => {
        const percent = (entry.count / gradeViz.total) * 100;
        return (
          <Tooltip
            key={entry.grade}
            label={tr("calendar.grade.histogramTooltip", {
              grade: entry.grade,
              count: entry.count,
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
                  height: `${Math.max(4, (entry.count / maxHistogramCount) * dims.maxBarPx)}px`,
                  backgroundColor: entry.count > 0 ? entry.color : "var(--app-translucent-strong)",
                }}
              />
              {!hideLabels ? (
                <Text
                  style={{ fontSize: dims.labelFontPx }}
                  c="gray.5"
                  ta="center"
                  className="cal-grade-histogram-label"
                >
                  {entry.grade}
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
              backgroundColor: bucket.color,
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
