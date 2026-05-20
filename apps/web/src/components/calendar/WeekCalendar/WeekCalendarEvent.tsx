import { useMemo } from "react";
import { Tooltip } from "@mantine/core";
import type { DataCache } from "@uoplan/schedule";
import {
  COURSE_COLORS,
  COURSE_COLOR_HEX,
  hexToRgb,
  ratingColorToCssVar,
  ratingToColor,
} from "@uoplan/schedule";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import { tr } from "../../../i18n";
import { GradeDistributionBottomBar } from "../GradeDistributionViz";
import { componentKindOnly, formatTimeRange } from "../calendarEventDisplayUtils";
import { CalendarEventFace } from "../CalendarEventFace";
import { minutesToPercent } from "./weekCalendarLayout";

interface WeekCalendarEventProps {
  event: CalendarEvent;
  laneIndex: number;
  laneCount: number;
  cache: DataCache | null;
  colorMap: Record<string, number>;
  onClick: (event: CalendarEvent) => void;
}

const LANE_GAP_PX = 1;

export function WeekCalendarEvent({
  event,
  laneIndex,
  laneCount,
  cache,
  colorMap,
  onClick,
}: WeekCalendarEventProps) {
  const courseTitle = useMemo(
    () => cache?.getCourse(event.courseCode)?.title ?? "",
    [cache, event.courseCode],
  );

  const colorIdx = colorMap[event.courseCode] ?? event.enrollmentIndex;
  const colorName = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
  const hex = COURSE_COLOR_HEX[colorName];
  const { r, g, b } = useMemo(() => hexToRgb(hex), [hex]);

  const legacyId = useMemo(
    () => event.professorRatingDetails?.find((d) => d.legacyId)?.legacyId,
    [event.professorRatingDetails],
  );
  const ratingTier = useMemo(
    () => ratingToColor(event.professorRatingValue ?? null),
    [event.professorRatingValue],
  );
  const markerColor = useMemo(() => ratingColorToCssVar(ratingTier), [ratingTier]);
  const hasProfessorRating = !!(
    event.professorRatingDetails && event.professorRatingDetails.length > 0
  );
  const hasNumericRating =
    hasProfessorRating &&
    event.professorRatingValue != null &&
    event.professorRatingValue > 0 &&
    !!event.professorRatingDetails;

  const timeRange = useMemo(
    () => formatTimeRange(event.startMinutes, event.endMinutes),
    [event.startMinutes, event.endMinutes],
  );

  const aPlusPercent = useMemo(() => {
    const gv = event.gradeViz;
    if (!gv || gv.total <= 0) return 0;
    const aPlusCount = gv.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
    return Math.round((aPlusCount / gv.total) * 100);
  }, [event.gradeViz]);

  const gradeTooltip =
    event.gradeViz && event.gradeViz.total > 0
      ? tr("calendar.grade.compactTooltip", {
          passing: Math.round(event.gradeViz.passingPercent),
          aPlus: aPlusPercent,
        })
      : null;

  const top = minutesToPercent(event.startMinutes);
  const height = minutesToPercent(event.endMinutes) - top;
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;

  const gradeBottom = <GradeDistributionBottomBar gradeViz={event.gradeViz} />;

  return (
    <div
      className="cal-event cal-event"
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${height}%`,
        minHeight: 0,
        left: `calc(${leftPct}% + ${laneIndex > 0 ? LANE_GAP_PX : 0}px)`,
        width: `calc(${widthPct}% - ${laneIndex > 0 ? LANE_GAP_PX : 0}px - ${laneIndex < laneCount - 1 ? LANE_GAP_PX : 0}px)`,
        cursor: "pointer",
        borderLeft: `4px solid ${hex}`,
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.38)`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
      data-color={markerColor}
      onClick={() => onClick(event)}
    >
      <CalendarEventFace
        courseCode={event.courseCode}
        courseTitle={courseTitle}
        componentSectionDisplay={componentKindOnly(event.componentSection)}
        timeRange={timeRange}
        professor={event.professor}
        virtual={event.virtual}
        layout={{ showSection: true, showTime: true, showProfessor: true }}
        ratingTier={ratingTier}
        hasProfessorRating={hasProfessorRating}
        hasNumericRating={hasNumericRating}
        professorRatingValue={event.professorRatingValue ?? null}
        legacyId={legacyId ?? null}
        professorRatingDetails={event.professorRatingDetails}
        interaction="interactive"
      />
      {gradeTooltip ? (
        <Tooltip label={gradeTooltip} withArrow position="top" withinPortal color="dark">
          <div className="cal-grade-bar-hitbox">{gradeBottom}</div>
        </Tooltip>
      ) : (
        <div className="cal-grade-bar-hitbox">{gradeBottom}</div>
      )}
    </div>
  );
}
