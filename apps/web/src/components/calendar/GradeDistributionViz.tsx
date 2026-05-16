import { Stack, Text, Tooltip } from "@mantine/core";
import type { GradeVizData } from "schedule";
import { tr } from "../../i18n";

const HIST_DIMS = {
  default: { maxBarPx: 88, snsPx: 88, padTopPx: 20, minWrapHeight: 94, labelFontPx: 10 },
  compact: { maxBarPx: 40, snsPx: 40, padTopPx: 4, minWrapHeight: 52, labelFontPx: 9 },
} as const;

export type GradeHistogramVariant = keyof typeof HIST_DIMS;

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
      className={overlay ? "uoplan-grade-passing-overlay" : undefined}
      lh={1.35}
    >
      {tr("calendar.grade.passingAndAPlus", {
        passing: Math.round(gradeViz.passingPercent),
        aPlus: aPlusPercent,
      })}
    </Text>
  );
}

/** Vertical grade histogram (letter buckets + S/NS stack). */
export function GradeDistributionHistogram({
  gradeViz,
  variant = "default",
}: {
  gradeViz: GradeVizData;
  variant?: GradeHistogramVariant;
}) {
  const dims = HIST_DIMS[variant];
  const { sCount, nsCount, snsTotal, histogramEntries, maxHistogramCount } =
    buildHistogramModel(gradeViz);

  const histClass =
    variant === "compact"
      ? "uoplan-grade-histogram uoplan-grade-histogram--compact"
      : "uoplan-grade-histogram";

  return (
    <div
      className={histClass}
      style={{
        paddingTop: dims.padTopPx,
        minHeight: dims.minWrapHeight,
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
            color="dark"
          >
            <div className="uoplan-grade-histogram-item">
              <div
                className="uoplan-grade-histogram-bar"
                style={{
                  height: `${Math.max(4, (entry.count / maxHistogramCount) * dims.maxBarPx)}px`,
                  backgroundColor: entry.count > 0 ? entry.color : "rgba(255,255,255,0.16)",
                }}
              />
              <Text
                style={{ fontSize: dims.labelFontPx }}
                c="gray.5"
                ta="center"
                className="uoplan-grade-histogram-label"
              >
                {entry.grade}
              </Text>
            </div>
          </Tooltip>
        );
      })}
      <Tooltip
        label={tr("calendar.grade.snsTooltip", { s: sCount, ns: nsCount })}
        withArrow
        position="top"
        withinPortal
        color="dark"
      >
        <div className="uoplan-grade-histogram-item uoplan-grade-histogram-item-sns">
          <div
            className="uoplan-grade-histogram-bar uoplan-grade-histogram-bar-sns"
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
                      backgroundColor: "#3266ad",
                    }}
                  />
                )}
                {nsCount > 0 && (
                  <span
                    style={{
                      height: `${(nsCount / snsTotal) * 100}%`,
                      backgroundColor: "#A32D2D",
                    }}
                  />
                )}
              </>
            ) : (
              <span
                style={{
                  height: "100%",
                  backgroundColor: "rgba(255,255,255,0.18)",
                }}
              />
            )}
          </div>
          <Text
            style={{ fontSize: dims.labelFontPx }}
            c="gray.5"
            ta="center"
            className="uoplan-grade-histogram-label"
          >
            {tr("calendar.grade.snsLabel")}
          </Text>
        </div>
      </Tooltip>
    </div>
  );
}

export function GradeDistributionCompactChip({
  gradeViz,
  variant = "default",
}: {
  gradeViz?: GradeVizData | null;
  variant?: "default" | "preview";
}) {
  if (!gradeViz || gradeViz.total <= 0) return null;

  const cls =
    variant === "preview" ? "uoplan-grade-chip uoplan-grade-chip--preview" : "uoplan-grade-chip";

  return (
    <div className={cls} aria-hidden>
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

/** Full-width horizontal strip at the bottom of a calendar event (constant column width). */
export function GradeDistributionBottomBar({ gradeViz }: { gradeViz?: GradeVizData | null }) {
  if (!gradeViz || gradeViz.total <= 0) {
    return (
      <div className="fc-uoplan-grade-bottom fc-uoplan-grade-bottom--no-grade-data" aria-hidden />
    );
  }

  return (
    <div className="fc-uoplan-grade-bottom fc-uoplan-grade-bottom--dist" aria-hidden>
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
      <div className="uoplan-grade-expanded-layout">
        <div className="uoplan-grade-histogram-wrap">
          <GradeDistributionPassingSummary gradeViz={gradeViz} overlay />
          <GradeDistributionHistogram gradeViz={gradeViz} variant="default" />
        </div>
      </div>
    </Stack>
  );
}
