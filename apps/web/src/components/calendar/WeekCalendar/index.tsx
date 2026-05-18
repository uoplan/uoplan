import { useMemo } from "react";
import type { DataCache, DayOfWeekCode } from "schedule";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import {
  WEEKDAY_CODES,
  FULL_WEEK_CODES,
  DAY_LABELS,
  HOUR_LABELS,
  HALF_HOUR_PERCENTS,
  assignLanes,
} from "./weekCalendarLayout";
import { WeekCalendarEvent } from "./WeekCalendarEvent";
import "./weekCalendar.css";

interface WeekCalendarProps {
  events: CalendarEvent[];
  cache: DataCache | null;
  colorMap?: Record<string, number>;
  onEventClick: (event: CalendarEvent) => void;
  showWeekends: boolean;
  animationPhase: "idle" | "exiting" | "entering";
}

const EMPTY_COLOR_MAP: Record<string, number> = {};

export function WeekCalendar({
  events,
  cache,
  colorMap = EMPTY_COLOR_MAP,
  onEventClick,
  showWeekends,
  animationPhase,
}: WeekCalendarProps) {
  const dayCodes: DayOfWeekCode[] = useMemo(
    () => (showWeekends ? FULL_WEEK_CODES : WEEKDAY_CODES),
    [showWeekends],
  );

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
                {laid.map(({ event, laneIndex, laneCount }) => (
                  <WeekCalendarEvent
                    key={event.id}
                    event={event}
                    laneIndex={laneIndex}
                    laneCount={laneCount}
                    cache={cache}
                    colorMap={colorMap}
                    onClick={onEventClick}
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
