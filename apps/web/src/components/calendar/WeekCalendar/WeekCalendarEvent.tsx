import { memo, useMemo } from "react";
import { Popover } from "@mantine/core";
import type { DataCache } from "@uoplan/core";
import { COURSE_COLOR_OKLCH, COURSE_COLORS, ratingToColor } from "@uoplan/core";
import { ratingColorToCssVar } from "../../../lib/ratingColor";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import { useTr } from "../../../i18n";
import { GradeDistributionBottomBar } from "../GradeDistributionViz";
import { CalendarEventDetails } from "../CalendarEventDetails";
import { componentKindOnly, formatTimeRange } from "../calendarEventDisplayUtils";
import { CalendarEventFace } from "../CalendarEventFace";
import { minutesToPercent } from "./weekCalendarLayout";
import "../calendar.css";

interface WeekCalendarEventProps {
  event: CalendarEvent;
  laneIndex: number;
  laneCount: number;
  cache: DataCache | null;
  colorMap: Record<string, number>;
  onClick: (event: CalendarEvent) => void;
  /** Whether this event is the one whose swap overlay is open. */
  isActive: boolean;
  /** Mobile renders a bottom drawer (in `CalendarView`), so no popover here. */
  isMobile: boolean;
  /** Fullscreen overlay (rendered by `CalendarView`) suppresses the popover. */
  isFullscreen: boolean;
  /** When true, open the popover with no entrance transition (shrinking from fullscreen). */
  instantPopover: boolean;
  /** Dismiss the active swap overlay (used when the popover closes itself). */
  onRequestClose: () => void;
}

const LANE_GAP_PX = 1;
const CALENDAR_EVENT_ARIA_LABEL_ID = "calendar.event.ariaLabel";

function WeekCalendarEventImpl({
  event,
  laneIndex,
  laneCount,
  cache,
  colorMap,
  onClick,
  isActive,
  isMobile,
  isFullscreen,
  instantPopover,
  onRequestClose,
}: WeekCalendarEventProps) {
  const tr = useTr();

  const courseTitle = useMemo(
    () => cache?.getCourse(event.courseCode)?.title ?? "",
    [cache, event.courseCode],
  );

  const colorIdx = colorMap[event.courseCode] ?? event.enrollmentIndex;
  const colorName = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
  const eventColor = COURSE_COLOR_OKLCH[colorName];

  const sentimentValue = event.courseSentiment ?? null;
  const sentimentTier = useMemo(() => ratingToColor(sentimentValue), [sentimentValue]);
  const markerColor = useMemo(() => ratingColorToCssVar(sentimentTier), [sentimentTier]);

  const timeRange = useMemo(
    () => formatTimeRange(event.startMinutes, event.endMinutes),
    [event.startMinutes, event.endMinutes],
  );

  const top = minutesToPercent(event.startMinutes);
  const height = minutesToPercent(event.endMinutes) - top;
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;

  const gradeBottom = <GradeDistributionBottomBar gradeViz={event.gradeViz} />;

  const handleActivate = () => onClick(event);

  const accessibleLabel = tr(CALENDAR_EVENT_ARIA_LABEL_ID, {
    courseCode: event.courseCode,
    component: componentKindOnly(event.componentSection),
    timeRange,
  });

  const isActivePopover = isActive && !isMobile && !isFullscreen;

  const eventButton = (
    <button
      type="button"
      className="cal-event"
      aria-label={accessibleLabel}
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${height}%`,
        minHeight: 0,
        left: `calc(${leftPct}% + ${laneIndex > 0 ? LANE_GAP_PX : 0}px)`,
        width: `calc(${widthPct}% - ${laneIndex > 0 ? LANE_GAP_PX : 0}px - ${laneIndex < laneCount - 1 ? LANE_GAP_PX : 0}px)`,
        cursor: "pointer",
        boxSizing: "border-box",
        appearance: "none",
        border: 0,
        borderLeft: "4px solid var(--event-color, var(--app-border-strong))",
        padding: 0,
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        overflow: "hidden",
        ["--event-color" as string]: eventColor,
      }}
      data-color={markerColor}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      <CalendarEventFace
        courseCode={event.courseCode}
        courseTitle={courseTitle}
        componentSectionDisplay={componentKindOnly(event.componentSection)}
        timeRange={timeRange}
        professor={event.predictedInstructors?.[0]?.name ?? event.professor}
        professorPredicted={(event.predictedInstructors?.length ?? 0) > 0}
        virtual={event.virtual}
        layout={{ showSection: true, showTime: true, showProfessor: true }}
        sentimentValue={sentimentValue}
      />
      <div className="cal-grade-bar-hitbox">{gradeBottom}</div>
    </button>
  );

  // On mobile the active event opens a bottom drawer (rendered by CalendarView),
  // so we never anchor a popover there.
  if (isMobile) {
    return eventButton;
  }

  return (
    <Popover
      opened={isActivePopover}
      onChange={(opened) => {
        if (!opened && isActive) onRequestClose();
      }}
      position="right"
      withArrow
      withinPortal
      trapFocus
      closeOnEscape
      closeOnClickOutside
      shadow="md"
      radius="md"
      transitionProps={instantPopover ? { duration: 0 } : undefined}
      middlewares={{ flip: true, shift: true }}
    >
      <Popover.Target>{eventButton}</Popover.Target>
      <Popover.Dropdown p={0} style={{ width: 360, maxWidth: "min(360px, 92vw)" }}>
        <div
          style={{
            maxHeight: "min(70vh, 560px)",
            overflowY: "auto",
            padding: "var(--mantine-spacing-sm)",
            scrollbarGutter: "stable",
          }}
        >
          <CalendarEventDetails event={event} courseTitle={courseTitle} />
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Memoized so that opening/closing the swap overlay (which changes only the
 * active event's `isActive`) re-renders just the previously- and newly-active
 * events instead of every event block on the grid.
 */
export const WeekCalendarEvent = memo(WeekCalendarEventImpl);
