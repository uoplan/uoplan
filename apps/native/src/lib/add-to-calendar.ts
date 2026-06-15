import { Platform } from "react-native";

import type { CalendarEvent } from "@uoplan/calendar/types";

import type { BuildIcsArgs } from "./ics";

const UOPLAN_CALENDAR_TITLE = "uoplan schedule";
const UOPLAN_CALENDAR_COLOR = "#208AEF";

type CalendarModule = typeof import("expo-calendar");
type ExpoCalendar = Awaited<ReturnType<CalendarModule["createCalendar"]>>;
type ExpoCalendarEvent = Awaited<ReturnType<ExpoCalendar["createEvent"]>>;
type CalendarCreateDetails = NonNullable<Parameters<CalendarModule["createCalendar"]>[0]>;
type CalendarSource = NonNullable<CalendarCreateDetails["source"]>;

type CalendarEventWithLocation = CalendarEvent & {
  location?: string | null;
};

type DayCode = CalendarEvent["day"];

const DAY_TO_ISO: Record<DayCode, number> = {
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6,
  Su: 7,
};

export interface CalendarEventSpec {
  title: string;
  location?: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
  weekdayIso: number;
  recurrenceEndDate: Date;
}

export interface AddScheduleToCalendarDeps {
  calendar?: CalendarModule;
  platformOS?: typeof Platform.OS;
}

export type AddScheduleToCalendarResult =
  | {
      status: "permission-denied";
      createdCount: 0;
    }
  | {
      status: "created";
      calendarId: string;
      calendarTitle: string;
      eventIds: string[];
      createdCount: number;
    };

function getCalendarModule(): CalendarModule {
  // Keep expo-calendar out of the test module graph unless the impure action runs.
  return require("expo-calendar");
}

function parseLocalDate(date: string): Date {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("Invalid date range for calendar export");

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error("Invalid date range for calendar export");
  }
  return parsed;
}

function jsDayToIso(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function addLocalDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function atMinutes(day: Date, minutes: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  );
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstOccurrence(termStart: Date, day: DayCode): Date {
  const delta = (DAY_TO_ISO[day] - jsDayToIso(termStart.getDay()) + 7) % 7;
  return addLocalDays(termStart, delta);
}

export function buildCalendarEventSpecs({
  events,
  startDate,
  endDate,
  titleFor,
}: BuildIcsArgs): CalendarEventSpec[] {
  const termStart = parseLocalDate(startDate);
  const termEnd = parseLocalDate(endDate);
  const recurrenceEndDate = new Date(
    termEnd.getFullYear(),
    termEnd.getMonth(),
    termEnd.getDate(),
    23,
    59,
    59,
  );

  return events.flatMap((event) => {
    if (event.startMinutes >= event.endMinutes) return [];

    const firstDay = firstOccurrence(termStart, event.day);
    const courseTitle = titleFor?.(event.courseCode)?.trim();
    const title = courseTitle ? `${event.courseCode} — ${courseTitle}` : event.courseCode;
    const notes = [
      trimOptional(event.componentSection)
        ? `Section: ${trimOptional(event.componentSection)}`
        : undefined,
      trimOptional(event.professor) ? `Prof: ${trimOptional(event.professor)}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    return [
      {
        title,
        location: trimOptional((event as CalendarEventWithLocation).location),
        notes: notes || undefined,
        startDate: atMinutes(firstDay, event.startMinutes),
        endDate: atMinutes(firstDay, event.endMinutes),
        weekdayIso: DAY_TO_ISO[event.day],
        recurrenceEndDate,
      },
    ];
  });
}

function iosDayOfTheWeek(weekdayIso: number) {
  if (weekdayIso < 1 || weekdayIso > 7) {
    throw new Error(`Invalid weekday: ${weekdayIso}`);
  }
  // Expo Calendar SDK 56's iOS recurrence record uses ISO numbering: Monday=1 ... Sunday=7.
  return weekdayIso;
}

async function getOrCreateUoplanCalendar(
  Calendar: CalendarModule,
  platformOS: typeof Platform.OS,
): Promise<ExpoCalendar> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(
    (calendar) => calendar.title === UOPLAN_CALENDAR_TITLE && calendar.allowsModifications,
  );
  if (existing) return existing;

  if (platformOS === "ios") {
    const defaultCalendar = Calendar.getDefaultCalendarSync();
    return Calendar.createCalendar({
      title: UOPLAN_CALENDAR_TITLE,
      color: UOPLAN_CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
    });
  }

  return Calendar.createCalendar({
    title: UOPLAN_CALENDAR_TITLE,
    name: "uoplan",
    color: UOPLAN_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    source: { isLocalAccount: true, name: "uoplan" } as CalendarSource,
    ownerAccount: "uoplan",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    isVisible: true,
    isSynced: true,
  });
}

function recurrenceRuleForSpec(
  Calendar: CalendarModule,
  spec: CalendarEventSpec,
  platformOS: typeof Platform.OS,
) {
  return {
    frequency: Calendar.Frequency.WEEKLY,
    interval: 1,
    endDate: spec.recurrenceEndDate,
    ...(platformOS === "ios"
      ? { daysOfTheWeek: [{ dayOfTheWeek: iosDayOfTheWeek(spec.weekdayIso) }] }
      : null),
  };
}

export async function addScheduleToCalendar(
  args: BuildIcsArgs,
  deps: AddScheduleToCalendarDeps = {},
): Promise<AddScheduleToCalendarResult> {
  const Calendar = deps.calendar ?? getCalendarModule();
  const platformOS = deps.platformOS ?? Platform.OS;
  const permission = await Calendar.requestCalendarPermissions(false);

  if (!permission.granted) {
    return { status: "permission-denied", createdCount: 0 };
  }

  const calendar = await getOrCreateUoplanCalendar(Calendar, platformOS);
  const specs = buildCalendarEventSpecs(args);
  const createdEvents = await Promise.all(
    specs.map((spec) =>
      calendar.createEvent({
        title: spec.title,
        location: spec.location,
        notes: spec.notes,
        startDate: spec.startDate,
        endDate: spec.endDate,
        recurrenceRule: recurrenceRuleForSpec(Calendar, spec, platformOS),
        availability: Calendar.Availability.BUSY,
      }),
    ),
  );

  return {
    status: "created",
    calendarId: calendar.id,
    calendarTitle: calendar.title,
    eventIds: createdEvents.map((event: ExpoCalendarEvent) => event.id),
    createdCount: createdEvents.length,
  };
}
