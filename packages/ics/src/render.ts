import type { DayOfWeek } from "@uoplan/domain/dataTypes";
import ical, { ICalEventRepeatingFreq, ICalWeekday } from "ical-generator";
import { addIsoDays, canonicalizeCalendarEvents } from "./model";
import type { CalendarEvent } from "./model";

const DEFAULT_PROD_ID = "//uoplan//EN";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDateToUtcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function recurrenceUntilUtcDate(date: string): Date {
  // Timed weekly recurrences use an inclusive local `untilDate`, but RFC5545
  // `UNTIL` is a UTC instant. Without a timezone library, a portable bound is
  // UTC midnight two calendar days later: every real IANA local date/time on
  // `untilDate` occurs before that instant, while a weekly `BYDAY` recurrence
  // cannot produce another occurrence until at least 7 days later.
  return isoDateToUtcDate(addIsoDays(date, 2));
}

function naiveLocalIso(date: string, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${date}T${pad2(hours)}:${pad2(remainingMinutes)}:00`;
}

function dayToIcalWeekday(day: DayOfWeek): ICalWeekday {
  switch (day) {
    case "Mo":
      return ICalWeekday.MO;
    case "Tu":
      return ICalWeekday.TU;
    case "We":
      return ICalWeekday.WE;
    case "Th":
      return ICalWeekday.TH;
    case "Fr":
      return ICalWeekday.FR;
    case "Sa":
      return ICalWeekday.SA;
    case "Su":
      return ICalWeekday.SU;
    default:
      throw new Error(`Unsupported weekday: ${String(day)}`);
  }
}

export function renderCalendarEvents(
  events: readonly CalendarEvent[],
  options?: {
    prodId?: string;
  },
): string {
  const calendar = ical({ prodId: options?.prodId ?? DEFAULT_PROD_ID });

  for (const event of canonicalizeCalendarEvents(events)) {
    if (event.time.kind === "all-day") {
      calendar.createEvent({
        id: event.uid,
        allDay: true,
        start: isoDateToUtcDate(event.time.startDate),
        end: isoDateToUtcDate(addIsoDays(event.time.endDate, 1)),
        summary: event.summary,
        description: event.description,
        location: event.location,
      });
      continue;
    }

    calendar.createEvent({
      id: event.uid,
      start: naiveLocalIso(event.time.date, event.time.startMinutes),
      end: naiveLocalIso(event.time.date, event.time.endMinutes),
      timezone: event.time.timeZone,
      summary: event.summary,
      description: event.description,
      location: event.location,
      repeating: event.recurrence
        ? {
            freq: ICalEventRepeatingFreq.WEEKLY,
            until: recurrenceUntilUtcDate(event.recurrence.untilDate),
            byDay: [dayToIcalWeekday(event.recurrence.day)],
            ...(event.recurrence.excludedDates.length > 0
              ? {
                  exclude: event.recurrence.excludedDates.map((excludedDate) =>
                    naiveLocalIso(excludedDate, event.time.startMinutes),
                  ),
                }
              : {}),
          }
        : undefined,
    });
  }

  return calendar.toString();
}
