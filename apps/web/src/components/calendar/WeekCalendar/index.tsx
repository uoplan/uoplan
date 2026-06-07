import { useMemo, useState } from "react";
import type { DataCache, DayOfWeekCode } from "@uoplan/core";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import type { BlockedTime } from "../../../store/types";
import { useAppStore } from "../../../store/appStore";
import {
  WEEKDAY_CODES,
  FULL_WEEK_CODES,
  DAY_LABELS,
  HOUR_LABELS,
  HALF_HOUR_PERCENTS,
  assignLanes,
} from "./weekCalendarLayout";
import { WeekCalendarEvent } from "./WeekCalendarEvent";
import { BlockedTimeLayer } from "./BlockedTimeLayer";
import { BlockedTimeRemoveModal } from "../BlockedTimeRemoveModal";
import "./weekCalendar.css";

interface WeekCalendarProps {
  events: CalendarEvent[];
  cache: DataCache | null;
  colorMap?: Record<string, number>;
  onEventClick: (event: CalendarEvent) => void;
  showWeekends: boolean;
  animationPhase: "idle" | "exiting" | "entering";
  /** Id of the event whose swap overlay is open (anchors the desktop popover). */
  activeEventId: string | null;
  isMobile: boolean;
  isFullscreen: boolean;
  /** Dismiss the active swap overlay. */
  onEventClose: () => void;
}

const EMPTY_COLOR_MAP: Record<string, number> = {};

export function WeekCalendar({
  events,
  cache,
  colorMap = EMPTY_COLOR_MAP,
  onEventClick,
  showWeekends,
  animationPhase,
  activeEventId,
  isMobile,
  isFullscreen,
  onEventClose,
}: WeekCalendarProps) {
  const dayCodes: DayOfWeekCode[] = useMemo(
    () => (showWeekends ? FULL_WEEK_CODES : WEEKDAY_CODES),
    [showWeekends],
  );

  const blockedTimes = useAppStore((s) => s.blockedTimes);
  const addBlockedTime = useAppStore((s) => s.addBlockedTime);
  const updateBlockedTime = useAppStore((s) => s.updateBlockedTime);
  const removeBlockedTime = useAppStore((s) => s.removeBlockedTime);
  const [blockToRemove, setBlockToRemove] = useState<BlockedTime | null>(null);

  const blocksByDay = useMemo(() => {
    const map = new Map<DayOfWeekCode, BlockedTime[]>();
    for (const day of dayCodes) map.set(day, []);
    for (const b of blockedTimes) map.get(b.day as DayOfWeekCode)?.push(b);
    return map;
  }, [blockedTimes, dayCodes]);

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
                <BlockedTimeLayer
                  day={day}
                  blocks={blocksByDay.get(day) ?? []}
                  onCommitCreate={(d, start, end) =>
                    addBlockedTime({ day: d, startMinutes: start, endMinutes: end })
                  }
                  onCommitUpdate={(id, start, end) =>
                    updateBlockedTime(id, { day, startMinutes: start, endMinutes: end })
                  }
                  onRequestRemove={setBlockToRemove}
                />
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
                    onRequestClose={onEventClose}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <BlockedTimeRemoveModal
        block={blockToRemove}
        onClose={() => setBlockToRemove(null)}
        onConfirm={(id) => {
          removeBlockedTime(id);
          setBlockToRemove(null);
        }}
      />
    </div>
  );
}
