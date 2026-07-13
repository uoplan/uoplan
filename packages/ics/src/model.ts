import type { DayOfWeek } from "@uoplan/domain/dataTypes";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;

type IsoDateParts = {
  year: number;
  month: number;
  day: number;
};

export type AllDayEventTime = {
  kind: "all-day";
  startDate: string;
  endDate: string;
};

export type TimedEventTime = {
  kind: "timed";
  date: string;
  startMinutes: number;
  endMinutes: number;
  timeZone: string;
};

export type WeeklyRecurrence = {
  frequency: "weekly";
  day: DayOfWeek;
  untilDate: string;
  excludedDates: string[];
  /**
   * The exact source meeting bounds this recurrence was derived from (e.g. a
   * schedule segment or a per-meeting date pair), independent of the
   * possibly-shifted first occurrence (`time.date`) and `untilDate`. Optional
   * for backward compatibility with generic/manually constructed events;
   * schedule-derived events always set it. Never rendered into ICS output —
   * it exists purely as matching metadata (see `matchEventToSession`).
   */
  activeRange?: {
    startDate: string;
    endDate: string;
  };
};

type CalendarEventBase = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
};

export type AllDayCalendarEvent = CalendarEventBase & {
  time: AllDayEventTime;
  recurrence?: never;
};

export type TimedCalendarEvent = CalendarEventBase & {
  time: TimedEventTime;
  recurrence?: WeeklyRecurrence;
};

export type CalendarEvent = AllDayCalendarEvent | TimedCalendarEvent;

const DAY_ORDER: readonly DayOfWeek[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function fail(message: string): never {
  throw new Error(message);
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    fail(`${label} must be a string`);
  }
  return value;
}

function asOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return;
  const stringValue = asString(value, label).trim();
  return stringValue || undefined;
}

function asInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value)) {
    fail(`${label} must be an integer`);
  }
  return value as number;
}

function parseIsoDateParts(date: string): IsoDateParts | null {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function isoDateToUtcDate(date: string): Date {
  const parts = parseIsoDateParts(date);
  if (!parts) {
    fail(`Invalid ISO date: ${date}`);
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
}

function utcDateToIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoIndexToDayOfWeek(index: number): DayOfWeek {
  return DAY_ORDER[index - 1] ?? fail(`Invalid ISO weekday index: ${index}`);
}

function dayOfWeekToIsoIndex(day: DayOfWeek): number {
  const index = DAY_ORDER.indexOf(day);
  if (index === -1) {
    fail(`Invalid weekday: ${day}`);
  }
  return index + 1;
}

export function isIsoDate(date: string): boolean {
  return parseIsoDateParts(date) !== null;
}

export function compareIsoDates(left: string, right: string): number {
  assertIsoDate(left, "left date");
  assertIsoDate(right, "right date");
  return left.localeCompare(right);
}

export function assertIsoDate(date: string, label = "date"): string {
  if (!isIsoDate(date)) {
    fail(`Invalid ${label}: ${date}`);
  }
  return date;
}

export function assertInclusiveDateRange(
  startDate: string,
  endDate: string,
  label = "date range",
): {
  startDate: string;
  endDate: string;
} {
  assertIsoDate(startDate, `${label} start date`);
  assertIsoDate(endDate, `${label} end date`);
  if (compareIsoDates(startDate, endDate) > 0) {
    fail(`${label} end date must be on or after the start date`);
  }
  return { startDate, endDate };
}

export function addIsoDays(date: string, days: number): string {
  const value = isoDateToUtcDate(assertIsoDate(date));
  value.setUTCDate(value.getUTCDate() + days);
  return utcDateToIsoDate(value);
}

/**
 * The signed day delta from `startDate` to `endDate` (positive when `endDate`
 * is later). Pure UTC arithmetic — never depends on the host's local
 * timezone.
 */
export function diffIsoDays(startDate: string, endDate: string): number {
  const start = isoDateToUtcDate(assertIsoDate(startDate, "start date"));
  const end = isoDateToUtcDate(assertIsoDate(endDate, "end date"));
  return Math.round((end.getTime() - start.getTime()) / (MINUTES_PER_DAY * 60 * 1000));
}

export function getIsoDayOfWeek(date: string): DayOfWeek {
  const value = isoDateToUtcDate(assertIsoDate(date));
  const jsDay = value.getUTCDay();
  return isoIndexToDayOfWeek(jsDay === 0 ? 7 : jsDay);
}

export function nextIsoDateOnOrAfter(startDate: string, day: DayOfWeek): string {
  const startIsoIndex = dayOfWeekToIsoIndex(getIsoDayOfWeek(assertIsoDate(startDate)));
  const targetIsoIndex = dayOfWeekToIsoIndex(day);
  const delta = (targetIsoIndex - startIsoIndex + 7) % 7;
  return addIsoDays(startDate, delta);
}

function canonicalizeTimedEventTime(value: unknown): TimedEventTime {
  const time = asObject(value, "timed event time");
  const date = assertIsoDate(asString(time.date, "timed event date"), "timed event date");
  const startMinutes = asInteger(time.startMinutes, "timed event start minutes");
  const endMinutes = asInteger(time.endMinutes, "timed event end minutes");

  if (startMinutes < 0 || startMinutes >= MINUTES_PER_DAY) {
    fail(`Timed event start minutes must be between 0 and ${MINUTES_PER_DAY - 1}`);
  }
  if (endMinutes <= 0 || endMinutes > MINUTES_PER_DAY) {
    fail(`Timed event end minutes must be between 1 and ${MINUTES_PER_DAY}`);
  }
  if (startMinutes >= endMinutes) {
    fail("Timed event end minutes must be after start minutes");
  }

  const timeZone = asString(time.timeZone, "timed event time zone").trim();
  if (!timeZone) {
    fail("Timed event time zone must not be empty");
  }

  return {
    kind: "timed",
    date,
    startMinutes,
    endMinutes,
    timeZone,
  };
}

function canonicalizeAllDayEventTime(value: unknown): AllDayEventTime {
  const time = asObject(value, "all-day event time");
  const startDate = asString(time.startDate, "all-day event start date");
  const endDate = asString(time.endDate, "all-day event end date");
  assertInclusiveDateRange(startDate, endDate, "all-day event");
  return {
    kind: "all-day",
    startDate,
    endDate,
  };
}

function canonicalizeActiveRange(
  value: unknown,
  firstDate: string,
  untilDate: string,
): { startDate: string; endDate: string } | undefined {
  if (value === undefined) return undefined;

  const rangeObject = asObject(value, "weekly recurrence active range");
  const startDate = assertIsoDate(
    asString(rangeObject.startDate, "weekly recurrence active range start date"),
    "weekly recurrence active range start date",
  );
  const endDate = assertIsoDate(
    asString(rangeObject.endDate, "weekly recurrence active range end date"),
    "weekly recurrence active range end date",
  );
  const range = assertInclusiveDateRange(startDate, endDate, "weekly recurrence active range");

  if (
    compareIsoDates(firstDate, range.startDate) < 0 ||
    compareIsoDates(firstDate, range.endDate) > 0
  ) {
    fail(
      "Weekly recurrence first occurrence must fall within the active range " +
        `[${range.startDate}, ${range.endDate}]`,
    );
  }
  if (compareIsoDates(untilDate, range.endDate) > 0) {
    fail("Weekly recurrence until date must not exceed the active range end date");
  }

  return range;
}

function canonicalizeWeeklyRecurrence(value: unknown, firstDate: string): WeeklyRecurrence {
  const recurrence = asObject(value, "weekly recurrence");
  const frequency = asString(recurrence.frequency, "weekly recurrence frequency");
  if (frequency !== "weekly") {
    fail(`Unsupported recurrence frequency: ${frequency}`);
  }

  const day = asString(recurrence.day, "weekly recurrence day") as DayOfWeek;
  dayOfWeekToIsoIndex(day);

  const untilDate = assertIsoDate(
    asString(recurrence.untilDate, "weekly recurrence until date"),
    "weekly recurrence until date",
  );

  if (compareIsoDates(untilDate, firstDate) < 0) {
    fail("Weekly recurrence until date must not be before the first occurrence");
  }
  if (getIsoDayOfWeek(firstDate) !== day) {
    fail("Weekly recurrence day must match the first occurrence date");
  }

  const rawExcludedDates = recurrence.excludedDates;
  if (!Array.isArray(rawExcludedDates)) {
    fail("Weekly recurrence excluded dates must be an array");
  }

  const excludedDates = [
    ...new Set(
      rawExcludedDates.map((excludedDate, index) =>
        assertIsoDate(
          asString(excludedDate, `weekly recurrence excluded date ${index + 1}`),
          "excluded date",
        ),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const activeRange = canonicalizeActiveRange(recurrence.activeRange, firstDate, untilDate);

  return {
    frequency: "weekly",
    day,
    untilDate,
    excludedDates,
    activeRange,
  };
}

export function canonicalizeCalendarEvent(event: unknown): CalendarEvent {
  const object = asObject(event, "calendar event");
  const uid = asString(object.uid, "calendar event uid").trim();
  const summary = asString(object.summary, "calendar event summary").trim();

  if (!uid) {
    fail("Calendar event uid must not be empty");
  }
  if (!summary) {
    fail("Calendar event summary must not be empty");
  }

  const description = asOptionalString(object.description, "calendar event description");
  const location = asOptionalString(object.location, "calendar event location");

  const time = asObject(object.time, "calendar event time");
  const kind = asString(time.kind, "calendar event time kind");

  if (kind === "all-day") {
    if (object.recurrence !== undefined) {
      fail("All-day event recurrence is not supported");
    }
    return {
      uid,
      summary,
      description,
      location,
      time: canonicalizeAllDayEventTime(time),
    };
  }

  if (kind === "timed") {
    const canonicalTime = canonicalizeTimedEventTime(time);
    const recurrence =
      object.recurrence === undefined
        ? undefined
        : canonicalizeWeeklyRecurrence(object.recurrence, canonicalTime.date);

    return {
      uid,
      summary,
      description,
      location,
      time: canonicalTime,
      recurrence,
    };
  }

  fail(`Unsupported calendar event time kind: ${kind}`);
}

export function canonicalizeCalendarEvents(events: readonly unknown[]): CalendarEvent[] {
  if (!Array.isArray(events)) {
    fail("Calendar events must be an array");
  }
  return events.map((event) => canonicalizeCalendarEvent(event));
}
