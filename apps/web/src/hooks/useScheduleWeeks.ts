import { useState, useMemo } from "react";
import type { GeneratedSchedule } from "schedule";

export interface WeekGroup {
  startDate: string; // ISO date string — Monday of first week in group
  endDate: string; // ISO date string — Sunday of last week in group
}

// Days offset from Monday (Mon=0, …, Sun=6)
const DAY_OFFSET: Record<string, number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

function getMondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, …
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns true if a time slot with the given day code and meetingDates actually
 * occurs during the week starting on `monday`. Uses the slot's specific day
 * occurrence date rather than a loose date-range overlap, so e.g. a Friday slot
 * ending on a Monday is correctly excluded from the following week.
 */
export function slotActiveInWeek(
  day: string,
  meetingDates: [string, string],
  monday: string,
): boolean {
  const occurrenceDate = addDays(monday, DAY_OFFSET[day] ?? 0);
  return occurrenceDate >= meetingDates[0] && occurrenceDate <= meetingDates[1];
}

interface WeekData {
  monday: string;
  fingerprint: string;
  slotCount: number;
  totalMinutes: number;
}

function computeWeekGroups(schedule: GeneratedSchedule): {
  groups: WeekGroup[];
  busiestIndex: number;
} {
  const datedTimes = schedule.enrollments.flatMap((e) =>
    Object.values(e.sectionCombo).flatMap(({ section }) =>
      section.times.filter((t) => t.meetingDates),
    ),
  );

  if (datedTimes.length === 0) return { groups: [], busiestIndex: 0 };

  const minDate = datedTimes.reduce(
    (min, t) => (t.meetingDates![0] < min ? t.meetingDates![0] : min),
    datedTimes[0].meetingDates![0],
  );
  const maxDate = datedTimes.reduce(
    (max, t) => (t.meetingDates![1] > max ? t.meetingDates![1] : max),
    datedTimes[0].meetingDates![1],
  );

  const firstMonday = getMondayOf(minDate);
  const lastMonday = getMondayOf(maxDate);

  const weekData: WeekData[] = [];
  let monday = firstMonday;
  while (monday <= lastMonday) {
    const activeTimes = datedTimes.filter((t) => slotActiveInWeek(t.day, t.meetingDates!, monday));

    // Skip weeks where no slots actually occur
    if (activeTimes.length > 0) {
      const fingerprint = activeTimes
        .map(
          (t) =>
            `${t.day}|${t.startMinutes}|${t.endMinutes}|${t.meetingDates![0]}|${t.meetingDates![1]}`,
        )
        .sort()
        .join(",");
      const totalMinutes = activeTimes.reduce((sum, t) => sum + (t.endMinutes - t.startMinutes), 0);
      weekData.push({ monday, fingerprint, slotCount: activeTimes.length, totalMinutes });
    }

    monday = addDays(monday, 7);
  }

  const groups: WeekGroup[] = [];
  // Track the max business per group (by slot count, then total minutes as tiebreak)
  const groupBusyness: Array<{ slotCount: number; totalMinutes: number }> = [];

  let i = 0;
  while (i < weekData.length) {
    const fp = weekData[i].fingerprint;
    let j = i + 1;
    // All weeks in this group share the same fingerprint, so same slot count/minutes
    while (j < weekData.length && weekData[j].fingerprint === fp) j++;
    groups.push({
      startDate: weekData[i].monday,
      endDate: addDays(weekData[j - 1].monday, 6),
    });
    groupBusyness.push({
      slotCount: weekData[i].slotCount,
      totalMinutes: weekData[i].totalMinutes,
    });
    i = j;
  }

  // Find the busiest group: most slots, then most minutes, then earliest (index 0 wins ties)
  let busiestIndex = 0;
  for (let g = 1; g < groupBusyness.length; g++) {
    const best = groupBusyness[busiestIndex];
    const curr = groupBusyness[g];
    if (
      curr.slotCount > best.slotCount ||
      (curr.slotCount === best.slotCount && curr.totalMinutes > best.totalMinutes)
    ) {
      busiestIndex = g;
    }
  }

  return { groups, busiestIndex };
}

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
