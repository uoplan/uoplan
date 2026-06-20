import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Calendar-route view state: the active planner variant (`basic`/`advanced`/null) and
 * the last-viewed week-group index, with their setters.
 */
export function useCalendarView() {
  const { calendarMode, calendarWeekIndex } = useAppStore(
    useShallow((s) => ({
      calendarMode: s.calendarMode,
      calendarWeekIndex: s.calendarWeekIndex,
    })),
  );

  const setCalendarMode = useAppStore((s) => s.setCalendarMode);
  const setCalendarWeekIndex = useAppStore((s) => s.setCalendarWeekIndex);

  return { calendarMode, calendarWeekIndex, setCalendarMode, setCalendarWeekIndex };
}

/** Blocked-time windows plus the add/update/remove editors used by the week calendar. */
export function useBlockedTimes() {
  const blockedTimes = useAppStore((s) => s.blockedTimes);
  const addBlockedTime = useAppStore((s) => s.addBlockedTime);
  const updateBlockedTime = useAppStore((s) => s.updateBlockedTime);
  const removeBlockedTime = useAppStore((s) => s.removeBlockedTime);
  return { blockedTimes, addBlockedTime, updateBlockedTime, removeBlockedTime };
}

/**
 * Read-only schedule-generation time window (earliest start / latest end minutes) used by
 * the week calendar to shade the "outside class hours" regions on every day, mirroring the
 * "class times between X and Y" constraint so it reads like the blocked times / avoided days.
 */
export function useGenerationTimeWindow() {
  return useAppStore(
    useShallow((s) => ({
      minStartMinutes: s.generationMinStartMinutes,
      maxEndMinutes: s.generationMaxEndMinutes,
    })),
  );
}
