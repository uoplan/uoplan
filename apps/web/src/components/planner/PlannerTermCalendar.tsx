import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import type {
  DataCache,
  DayOfWeekCode,
  GeneratedSchedule,
  ProfessorRatingsMap,
} from "@uoplan/core";
import { scheduleToEvents } from "@uoplan/calendar";
import { WeekCalendarGrid } from "../calendar/WeekCalendar/WeekCalendarGrid";
import { FULL_WEEK_CODES, WEEKDAY_CODES } from "../calendar/WeekCalendar/weekCalendarLayout";
import { useScheduleTransition } from "../../hooks/useScheduleTransition";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { PlannerEventDetails } from "./PlannerEventDetails";

const WEEKDAYS: DayOfWeekCode[] = WEEKDAY_CODES;
const FULL_WEEK: DayOfWeekCode[] = FULL_WEEK_CODES;

interface PlannerTermCalendarProps {
  schedule: GeneratedSchedule | null;
  cache: DataCache | null;
  colorMap?: Record<string, number>;
  professorRatings: ProfessorRatingsMap | null;
}

/**
 * Read-only weekly calendar for a single planned term, rendered inside a graph
 * term node. It reuses the same grid the interactive calendar uses (identical
 * layout, event faces, and colours) and clicking a course opens a read-only
 * details popover ({@link PlannerEventDetails}). It strips the editing overlays:
 * no blocked times, no generation window, no swap list (that lives behind "Open
 * in calendar"). It renders exactly the term's generated schedule so the graph
 * shows the real timetable at a glance. When the term is regenerated the new
 * schedule fades in with the same exit -> enter animation as the main calendar.
 */
export function PlannerTermCalendar({
  schedule,
  cache,
  colorMap,
  professorRatings,
}: PlannerTermCalendarProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  // Drive the same fade-out -> swap -> fade-in the main calendar uses, so a
  // regenerated term visibly transitions to its new schedule in the graph.
  const { displayedSchedule, animationPhase } = useScheduleTransition(schedule, prefersReduced);

  const events: CalendarEvent[] = useMemo(
    () => (displayedSchedule ? scheduleToEvents(displayedSchedule, professorRatings) : []),
    [displayedSchedule, professorRatings],
  );

  // The popover targets an event id; when the schedule changes those ids no
  // longer exist, so close it to avoid a dangling popover.
  useEffect(() => setActiveEventId(null), [schedule]);

  // Only widen to the weekend when the term actually meets then, so a normal
  // Mon-Fri schedule keeps five roomy columns.
  const showWeekends = useMemo(
    () => events.some((ev) => ev.day === "Sa" || ev.day === "Su"),
    [events],
  );

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setActiveEventId((current) => (current === event.id ? null : event.id));
  }, []);
  const handleEventClose = useCallback(() => setActiveEventId(null), []);
  const renderEventDetails = useCallback(
    (event: CalendarEvent, courseTitle: string) => (
      <PlannerEventDetails event={event} courseTitle={courseTitle} />
    ),
    [],
  );

  return (
    <WeekCalendarGrid
      events={events}
      cache={cache}
      colorMap={colorMap}
      dayCodes={showWeekends ? FULL_WEEK : WEEKDAYS}
      animationPhase={animationPhase}
      activeEventId={activeEventId}
      onEventClick={handleEventClick}
      onEventClose={handleEventClose}
      isMobile={false}
      isFullscreen={false}
      renderEventDetails={renderEventDetails}
    />
  );
}
