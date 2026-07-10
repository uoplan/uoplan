import { useMemo, useState } from "react";
import type { DataCache, DayOfWeekCode } from "@uoplan/core";
import type { CalendarEvent } from "../../../hooks/useCalendarEvents";
import type { BlockedTime } from "@uoplan/store/types";
import { useBlockedTimes, useGenerationTimeWindow } from "@uoplan/store/hooks";
import { FULL_WEEK_CODES, WEEKDAY_CODES } from "./weekCalendarLayout";
import { WeekCalendarGrid } from "./WeekCalendarGrid";
import { BlockedTimeLayer } from "./BlockedTimeLayer";
import { GenerationWindowLayer } from "./GenerationWindowLayer";
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
  /** Open the active event's popover with no entrance transition (used when
   * shrinking out of fullscreen so it appears instantly under the fading overlay). */
  instantPopover?: boolean;
  /** Dismiss the active swap overlay. */
  onEventClose: () => void;
}

export function WeekCalendar({
  events,
  cache,
  colorMap,
  onEventClick,
  showWeekends,
  animationPhase,
  activeEventId,
  isMobile,
  isFullscreen,
  instantPopover = false,
  onEventClose,
}: WeekCalendarProps) {
  const dayCodes: DayOfWeekCode[] = useMemo(
    () => (showWeekends ? FULL_WEEK_CODES : WEEKDAY_CODES),
    [showWeekends],
  );

  const { blockedTimes, addBlockedTime, updateBlockedTime, removeBlockedTime } = useBlockedTimes();
  const { minStartMinutes, maxEndMinutes } = useGenerationTimeWindow();
  const [blockToRemove, setBlockToRemove] = useState<BlockedTime | null>(null);

  const blocksByDay = useMemo(() => {
    const map = new Map<DayOfWeekCode, BlockedTime[]>();
    for (const day of dayCodes) map.set(day, []);
    for (const b of blockedTimes) map.get(b.day as DayOfWeekCode)?.push(b);
    return map;
  }, [blockedTimes, dayCodes]);

  return (
    <>
      <WeekCalendarGrid
        events={events}
        cache={cache}
        colorMap={colorMap}
        dayCodes={dayCodes}
        animationPhase={animationPhase}
        activeEventId={activeEventId}
        onEventClick={onEventClick}
        onEventClose={onEventClose}
        isMobile={isMobile}
        isFullscreen={isFullscreen}
        instantPopover={instantPopover}
        renderDayUnderlay={(day) => (
          <>
            <GenerationWindowLayer
              minStartMinutes={minStartMinutes}
              maxEndMinutes={maxEndMinutes}
            />
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
          </>
        )}
      />
      <BlockedTimeRemoveModal
        block={blockToRemove}
        onClose={() => setBlockToRemove(null)}
        onConfirm={(id) => {
          removeBlockedTime(id);
          setBlockToRemove(null);
        }}
      />
    </>
  );
}
