import type { GeneratedSchedule } from "@uoplan/core";

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

type ScheduleTime =
  GeneratedSchedule["enrollments"][number]["sectionCombo"][string]["section"]["times"][number];
type DatedScheduleTime = ScheduleTime & { meetingDates: [string, string] };

function hasMeetingDates(time: ScheduleTime): time is DatedScheduleTime {
  return Boolean(time.meetingDates);
}

function getDatedTimes(schedule: GeneratedSchedule): DatedScheduleTime[] {
  return schedule.enrollments.flatMap((e) =>
    Object.values(e.sectionCombo).flatMap(({ section }) => section.times.filter(hasMeetingDates)),
  );
}

function getDateRange(datedTimes: DatedScheduleTime[]): [string, string] {
  const minDate = datedTimes.reduce(
    (min, t) => (t.meetingDates[0] < min ? t.meetingDates[0] : min),
    datedTimes[0].meetingDates[0],
  );
  const maxDate = datedTimes.reduce(
    (max, t) => (t.meetingDates[1] > max ? t.meetingDates[1] : max),
    datedTimes[0].meetingDates[1],
  );
  return [minDate, maxDate];
}

function enumerateWeekMondays(minDate: string, maxDate: string): string[] {
  const firstMonday = getMondayOf(minDate);
  const lastMonday = getMondayOf(maxDate);
  const mondays: string[] = [];

  let monday = firstMonday;
  while (monday <= lastMonday) {
    mondays.push(monday);
    monday = addDays(monday, 7);
  }

  return mondays;
}

function fingerprintTimes(activeTimes: DatedScheduleTime[]): string {
  return activeTimes
    .map(
      (t) => `${t.day}|${t.startMinutes}|${t.endMinutes}|${t.meetingDates[0]}|${t.meetingDates[1]}`,
    )
    .sort()
    .join(",");
}

function scoreTimes(activeTimes: DatedScheduleTime[]): { slotCount: number; totalMinutes: number } {
  return {
    slotCount: activeTimes.length,
    totalMinutes: activeTimes.reduce((sum, t) => sum + (t.endMinutes - t.startMinutes), 0),
  };
}

function buildWeekData(datedTimes: DatedScheduleTime[], mondays: string[]): WeekData[] {
  const weekData: WeekData[] = [];

  for (const monday of mondays) {
    const activeTimes = datedTimes.filter((t) => slotActiveInWeek(t.day, t.meetingDates, monday));

    if (activeTimes.length > 0) {
      weekData.push({
        monday,
        fingerprint: fingerprintTimes(activeTimes),
        ...scoreTimes(activeTimes),
      });
    }
  }

  return weekData;
}

function groupConsecutiveWeeks(weekData: WeekData[]): {
  groups: WeekGroup[];
  groupBusyness: Array<{ slotCount: number; totalMinutes: number }>;
} {
  const groups: WeekGroup[] = [];
  const groupBusyness: Array<{ slotCount: number; totalMinutes: number }> = [];
  let i = 0;

  while (i < weekData.length) {
    const fingerprint = weekData[i].fingerprint;
    let j = i + 1;
    while (j < weekData.length && weekData[j].fingerprint === fingerprint) j++;
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

  return { groups, groupBusyness };
}

function findBusiestGroupIndex(
  groupBusyness: Array<{ slotCount: number; totalMinutes: number }>,
): number {
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
  return busiestIndex;
}

export function computeWeekGroups(schedule: GeneratedSchedule): {
  groups: WeekGroup[];
  busiestIndex: number;
} {
  const datedTimes = getDatedTimes(schedule);
  if (datedTimes.length === 0) return { groups: [], busiestIndex: 0 };

  const [minDate, maxDate] = getDateRange(datedTimes);
  const weekData = buildWeekData(datedTimes, enumerateWeekMondays(minDate, maxDate));
  const { groups, groupBusyness } = groupConsecutiveWeeks(weekData);

  return { groups, busiestIndex: findBusiestGroupIndex(groupBusyness) };
}
