import { useMemo } from "react";
import type { ReactNode } from "react";
import type { DataCache, DayOfWeekCode } from "@uoplan/core";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import { assignLanes, DAY_LABELS, HALF_HOUR_PERCENTS, HOUR_LABELS } from "./weekCalendarLayout";
import { WeekCalendarEvent } from "./WeekCalendarEvent";
import "./weekCalendar.css";

interface WeekCalendarGridProps {
  events: CalendarEvent[];
  cache: DataCache | null;
  colorMap?: Record<string, number>;
  /** Which day columns to render (weekdays or the full week). */
  dayCodes: DayOfWeekCode[];
  animationPhase: "idle" | "exiting" | "entering";
  activeEventId: string | null;
  onEventClick: (event: CalendarEvent) => void;
  onEventClose: () => void;
  isMobile: boolean;
  isFullscreen: boolean;
  instantPopover?: boolean;
  /**
   * Custom popover content per event, forwarded to each {@link WeekCalendarEvent}.
   * The interactive calendar leaves this undefined (swap overlay); the planner
   * term calendar passes a read-only details renderer.
   */
  renderEventDetails?: (event: CalendarEvent, courseTitle: string) => ReactNode;
  /**
   * Optional per-day underlay rendered behind the events (generation-window and
   * blocked-time layers in the interactive calendar). Omitted for a read-only
   * grid, which shows just the timetable.
   */
  renderDayUnderlay?: (day: DayOfWeekCode) => ReactNode;
}

const EMPTY_COLOR_MAP: Record<string, number> = {};

/**
 * The presentational week grid shared by the interactive {@link WeekCalendar}
 * and the read-only planner term calendar: a time axis plus one column per day
 * with hour/half-hour guides and laid-out event blocks. Interactivity (blocked
 * times, generation window, swap popovers) is layered in by the caller via
 * `renderDayUnderlay` and the event handlers, so the grid itself stays a pure
 * function of `events`.
 */
export function WeekCalendarGrid({
  events,
  cache,
  colorMap = EMPTY_COLOR_MAP,
  dayCodes,
  animationPhase,
  activeEventId,
  onEventClick,
  onEventClose,
  isMobile,
  isFullscreen,
  instantPopover = false,
  renderEventDetails,
  renderDayUnderlay,
}: WeekCalendarGridProps) {
  const eventsByDay = useMemo(() => {
    const map = new Map<DayOfWeekCode, CalendarEvent[]>();
    for (const day of dayCodes) map.set(day, []);
    for (const ev of events) {
      map.get(ev.day)?.push(ev);
    }
    return map;
  }, [events, dayCodes]);

  return (
    <div className="cal-root" data-phase={animationPhase}>
      {/* Time axis */}
      <div className="cal-time-axis">
        <div className="cal-time-axis-inner">
          {HOUR_LABELS.map(({ label, percent }) => (
            <div key={label} className="cal-time-label" style={{ top: `${percent}%` }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Day columns */}
      <div className="cal-columns">
        {/* Hour lines (behind all columns) */}
        <div className="cal-hour-lines" aria-hidden>
          {HOUR_LABELS.map(({ label, percent }) => (
            <div key={label} className="cal-hour-line" style={{ top: `${percent}%` }} />
          ))}
        </div>

        {dayCodes.map((day) => {
          const dayEvents = eventsByDay.get(day) ?? [];
          const laid = assignLanes(dayEvents);
          return (
            <div key={day} className="cal-column">
              <div className="cal-col-header">{DAY_LABELS[day]}</div>
              <div className="cal-col-body">
                {/* Half-hour dividers */}
                {HALF_HOUR_PERCENTS.map((percent) => (
                  <div
                    key={percent}
                    className="cal-half-line"
                    style={{ top: `${percent}%` }}
                    aria-hidden
                  />
                ))}
                {renderDayUnderlay?.(day)}
                {laid.map(({ event, laneIndex, laneCount }) => (
                  <WeekCalendarEvent
                    key={event.id}
                    event={event}
                    laneIndex={laneIndex}
                    laneCount={laneCount}
                    cache={cache}
                    colorMap={colorMap}
                    onClick={onEventClick}
                    isActive={event.id === activeEventId}
                    isMobile={isMobile}
                    isFullscreen={isFullscreen}
                    instantPopover={instantPopover && event.id === activeEventId}
                    onRequestClose={onEventClose}
                    renderDetails={renderEventDetails}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
