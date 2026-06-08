import type { GeneratedSchedule } from "@uoplan/core";
import { scheduleToEvents } from "./events";
import { renderCalendarToSvg } from "./render";
import type { CalendarEvent } from "./types";
import { computeWeekGroups, slotActiveInWeek } from "./weeks";

export function scheduleToBusiestWeekEvents(schedule: GeneratedSchedule): CalendarEvent[] {
  const events = scheduleToEvents(schedule, null);
  const { groups, busiestIndex } = computeWeekGroups(schedule);
  const busiestGroup = groups[busiestIndex] ?? null;

  return busiestGroup
    ? events.filter(
        (event) =>
          !event.meetingDates ||
          slotActiveInWeek(event.day, event.meetingDates, busiestGroup.startDate),
      )
    : events;
}

export function renderSchedulePreviewToSvg(
  schedule: GeneratedSchedule,
  colorMap: Record<string, number>,
): string {
  return renderCalendarToSvg(scheduleToBusiestWeekEvents(schedule), colorMap);
}
