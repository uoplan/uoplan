import { useState, useMemo } from "react";
import type { GeneratedSchedule } from "@uoplan/core";
import type { WeekGroup } from "@uoplan/calendar";
import { computeWeekGroups } from "@uoplan/calendar";

export type { WeekGroup } from "@uoplan/calendar";
export { slotActiveInWeek } from "@uoplan/calendar";

export function useScheduleWeeks(
  schedule: GeneratedSchedule | null,
  initialWeekIndex?: number | null,
): {
  weekGroups: WeekGroup[];
  weekIndex: number;
  setWeekIndex: (index: number) => void;
} {
  const { groups: weekGroups, busiestIndex } = useMemo(
    () => (schedule ? computeWeekGroups(schedule) : { groups: [], busiestIndex: 0 }),
    [schedule],
  );

  const [weekIndex, setWeekIndex] = useState(() => {
    if (initialWeekIndex != null && initialWeekIndex >= 0 && initialWeekIndex < weekGroups.length) {
      return initialWeekIndex;
    }
    return busiestIndex;
  });
  const [lastSchedule, setLastSchedule] = useState(schedule);

  if (schedule !== lastSchedule) {
    setLastSchedule(schedule);
    // Use the provided initial index if valid, otherwise default to the busiest week
    const target =
      initialWeekIndex != null && initialWeekIndex >= 0 && initialWeekIndex < weekGroups.length
        ? initialWeekIndex
        : busiestIndex;
    setWeekIndex(target);
  }

  return { weekGroups, weekIndex, setWeekIndex };
}
