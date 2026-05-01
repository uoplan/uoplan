import { Stack, Text, Tooltip } from "@mantine/core";
import type { GradeVizData } from "schedule";
import { tr } from "../../i18n";

export function GradeDistributionCompactChip({
  gradeViz,
}: {
  gradeViz?: GradeVizData | null;
}) {
  if (!gradeViz || gradeViz.total <= 0) return null;

  return (
    <div className="uoplan-grade-chip" aria-hidden>
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

export function GradeDistributionExpanded({
  gradeViz,
}: {
  gradeViz?: GradeVizData | null;
}) {
  if (!gradeViz || gradeViz.total <= 0) return null;

  const sCount = gradeViz.histogram.find((entry) => entry.grade === "S")?.count ?? 0;
  const nsCount = gradeViz.histogram.find((entry) => entry.grade === "NS")?.count ?? 0;
  const snsTotal = sCount + nsCount;
  const aPlusCount = gradeViz.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
  const aPlusPercent = Math.round((aPlusCount / gradeViz.total) * 100);
  const histogramEntries = gradeViz.histogram.filter(
    (entry) => entry.grade !== "P" && entry.grade !== "S",
  );
  const maxHistogramCount = Math.max(...histogramEntries.map((h) => h.count), 1);

  return (
    <Stack gap={8}>
      <div className="uoplan-grade-expanded-layout">
        <div className="uoplan-grade-histogram-wrap">
          <Text size="sm" fw={700} c="gray.2" className="uoplan-grade-passing-overlay">
            {tr("calendar.grade.passingAndAPlus", {
              passing: Math.round(gradeViz.passingPercent),
              aPlus: aPlusPercent,
            })}
          </Text>
          <div className="uoplan-grade-histogram" aria-hidden>
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
                        height: `${Math.max(4, (entry.count / maxHistogramCount) * 88)}px`,
                        backgroundColor:
                          entry.count > 0 ? entry.color : "rgba(255,255,255,0.16)",
                      }}
                    />
                    <Text size="10px" c="gray.5" ta="center" className="uoplan-grade-histogram-label">
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
                    height: "88px",
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
                <Text size="10px" c="gray.5" ta="center" className="uoplan-grade-histogram-label">
                  {tr("calendar.grade.snsLabel")}
                </Text>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </Stack>
  );
}
