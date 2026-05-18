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

function computeWeekGroups(schedule: GeneratedSchedule): WeekGroup[] {
  const datedTimes = schedule.enrollments.flatMap((e) =>
    Object.values(e.sectionCombo).flatMap(({ section }) =>
      section.times.filter((t) => t.meetingDates),
    ),
  );

  if (datedTimes.length === 0) return [];

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

  const weekData: Array<{ monday: string; fingerprint: string }> = [];
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
      weekData.push({ monday, fingerprint });
    }

    monday = addDays(monday, 7);
  }

  const groups: WeekGroup[] = [];
  let i = 0;
  while (i < weekData.length) {
    const fp = weekData[i].fingerprint;
    let j = i + 1;
    while (j < weekData.length && weekData[j].fingerprint === fp) j++;
    groups.push({
      startDate: weekData[i].monday,
      endDate: addDays(weekData[j - 1].monday, 6),
    });
    i = j;
  }

  return groups;
}

export function useScheduleWeeks(schedule: GeneratedSchedule | null): {
  weekGroups: WeekGroup[];
  weekIndex: number;
  setWeekIndex: (index: number) => void;
} {
  const weekGroups = useMemo(() => (schedule ? computeWeekGroups(schedule) : []), [schedule]);

  const [weekIndex, setWeekIndex] = useState(0);
  const [lastSchedule, setLastSchedule] = useState(schedule);

  if (schedule !== lastSchedule) {
    setLastSchedule(schedule);
    setWeekIndex(0);
  }

  return { weekGroups, weekIndex, setWeekIndex };
}
