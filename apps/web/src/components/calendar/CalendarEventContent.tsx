import { useMemo } from "react";
import { Tooltip } from "@mantine/core";
import type { DataCache, GradeVizData } from "schedule";
import { COURSE_COLORS, COURSE_COLOR_HEX, hexToRgb, ratingColorToCssVar, ratingToColor } from "schedule";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { tr } from "../../i18n";
import { GradeDistributionBottomBar } from "./GradeDistributionViz";
import { componentKindOnly, formatTimeRange } from "./calendarEventDisplayUtils";
import { CalendarEventFace, type CalendarEventFaceLayout } from "./CalendarEventFace";

function encodeGradeVizDataset(v: GradeVizData | null | undefined): string | undefined {
  if (!v || v.total <= 0) return undefined;
  try {
    return encodeURIComponent(JSON.stringify(v));
  } catch {
    return undefined;
  }
}

/** Fixed layout: typography does not depend on slot width/height (no ResizeObserver). */
const CALENDAR_FACE_LAYOUT: CalendarEventFaceLayout = {
  showSection: true,
  showTime: true,
  showProfessor: true,
};

export function CalendarEventContent({
  ext,
  cache,
  colorMap,
}: {
  ext: CalendarEvent;
  cache: DataCache | null;
  colorMap: Record<string, number>;
}) {
  const courseTitle = useMemo(
    () => cache?.getCourse(ext.courseCode)?.title ?? "",
    [cache, ext.courseCode],
  );

  const colorIdx = colorMap[ext.courseCode] ?? ext.enrollmentIndex;
  const colorName = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
  const hex = COURSE_COLOR_HEX[colorName];
  const { r, g, b } = useMemo(() => hexToRgb(hex), [hex]);

  const legacyId = useMemo(
    () => ext.professorRatingDetails?.find((d) => d.legacyId)?.legacyId,
    [ext.professorRatingDetails],
  );
  const ratingTier = useMemo(
    () => ratingToColor(ext.professorRatingValue ?? null),
    [ext.professorRatingValue],
  );
  const markerColor = useMemo(() => ratingColorToCssVar(ratingTier), [ratingTier]);
  const hasProfessorRating = !!(ext.professorRatingDetails && ext.professorRatingDetails.length > 0);
  const hasNumericRating =
    hasProfessorRating &&
    ext.professorRatingValue != null &&
    ext.professorRatingValue > 0 &&
    !!ext.professorRatingDetails;

  const timeRange = useMemo(
    () => formatTimeRange(ext.startMinutes, ext.endMinutes),
    [ext.startMinutes, ext.endMinutes],
  );
  const aPlusPercent = useMemo(() => {
    const gradeViz = ext.gradeViz;
    if (!gradeViz || gradeViz.total <= 0) return 0;
    const aPlusCount = gradeViz.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
    return Math.round((aPlusCount / gradeViz.total) * 100);
  }, [ext.gradeViz]);

  const gradeTooltip =
    ext.gradeViz && ext.gradeViz.total > 0 ? (
      tr("calendar.grade.compactTooltip", {
        passing: Math.round(ext.gradeViz.passingPercent),
        aPlus: aPlusPercent,
      })
    ) : null;

  const gradeBottom = <GradeDistributionBottomBar gradeViz={ext.gradeViz} />;

  return (
    <div
      className="fc-uoplan-event"
      data-course-code={ext.courseCode}
      data-course-title={courseTitle || undefined}
      data-color-hex={hex}
      data-event-time={timeRange}
      data-virtual={ext.virtual ? "true" : undefined}
      data-rating-color={hasProfessorRating ? markerColor : ""}
      data-rating-tier={hasNumericRating ? ratingTier : undefined}
      data-professor-rating-value={
        hasNumericRating && ext.professorRatingValue != null
          ? String(ext.professorRatingValue)
          : undefined
      }
      data-rmp-legacy-id={legacyId != null ? String(legacyId) : undefined}
      data-grade-viz={encodeGradeVizDataset(ext.gradeViz)}
      style={{
        cursor: "pointer",
        borderLeft: `4px solid ${hex}`,
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.38)`,
      }}
    >
      <CalendarEventFace
        courseCode={ext.courseCode}
        courseTitle={courseTitle}
        componentSectionDisplay={componentKindOnly(ext.componentSection)}
        timeRange={timeRange}
        professor={ext.professor}
        virtual={ext.virtual}
        layout={CALENDAR_FACE_LAYOUT}
        ratingTier={ratingTier}
        hasProfessorRating={hasProfessorRating}
        hasNumericRating={hasNumericRating}
        professorRatingValue={ext.professorRatingValue ?? null}
        legacyId={legacyId ?? null}
        professorRatingDetails={ext.professorRatingDetails}
        interaction="interactive"
      />
      {gradeTooltip ? (
        <Tooltip label={gradeTooltip} withArrow position="top" withinPortal color="dark">
          <div className="fc-uoplan-grade-bottom-hitbox">{gradeBottom}</div>
        </Tooltip>
      ) : (
        <div className="fc-uoplan-grade-bottom-hitbox">{gradeBottom}</div>
      )}
    </div>
  );
}
