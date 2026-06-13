import type { CalendarEvent } from "@uoplan/calendar/types";

/**
 * Pure-JS iCalendar (RFC 5545) builder for the native app. The web app builds
 * its `.ics` with `ical-generator`, which is Node-only and can't run under
 * Hermes — so native ships this dependency-free builder instead. It emits one
 * weekly-recurring VEVENT per timetable meeting, using *floating* local times
 * (no `Z`, no VTIMEZONE) so each event lands at its wall-clock time in the
 * viewer's calendar, which is the right behaviour for a single-campus timetable.
 */

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

const ICS_DAY_CODE: Record<DayCode, string> = {
  Mo: "MO",
  Tu: "TU",
  We: "WE",
  Th: "TH",
  Fr: "FR",
  Sa: "SA",
  Su: "SU",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseIsoDate(date: string): Date | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addUtcDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

function jsUtcDayToIso(jsUtcDay: number): number {
  return jsUtcDay === 0 ? 7 : jsUtcDay;
}

/** Local (floating) date-time stamp: `YYYYMMDDTHHMMSS`. */
function localStamp(dayUtcMidnight: Date, minutes: number): string {
  const y = dayUtcMidnight.getUTCFullYear();
  const mo = pad2(dayUtcMidnight.getUTCMonth() + 1);
  const d = pad2(dayUtcMidnight.getUTCDate());
  return `${y}${mo}${d}T${pad2(Math.floor(minutes / 60))}${pad2(minutes % 60)}00`;
}

/** UTC stamp with trailing `Z`, used for DTSTAMP / RRULE UNTIL. */
function utcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const h = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const s = pad2(date.getUTCSeconds());
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to 75 octets per RFC 5545 (continuation lines start with a space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export interface BuildIcsArgs {
  events: CalendarEvent[];
  /** Term start, `YYYY-MM-DD`. */
  startDate: string;
  /** Term end, `YYYY-MM-DD` (inclusive recurrence boundary). */
  endDate: string;
  /** Optional course-code → title lookup for nicer summaries. */
  titleFor?: (courseCode: string) => string | undefined;
}

/**
 * Build a complete VCALENDAR string for the given weekly timetable events.
 * Returns CRLF-delimited text suitable for writing to a `.ics` file.
 */
export function buildScheduleIcs({ events, startDate, endDate, titleFor }: BuildIcsArgs): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) throw new Error("Invalid date range for iCalendar export");

  const until = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59),
  );
  const dtstamp = utcStamp(new Date(0));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//uoplan//native//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    if (event.startMinutes >= event.endMinutes) continue;

    const isoDow = DAY_TO_ISO[event.day];
    const startDow = jsUtcDayToIso(start.getUTCDay());
    const delta = (isoDow - startDow + 7) % 7;
    const firstDay = addUtcDays(start, delta);

    const title = titleFor?.(event.courseCode)?.trim();
    const summary = title ? `${event.courseCode} — ${title}` : event.courseCode;
    const description = [
      event.componentSection ? `Section: ${event.componentSection}` : null,
      event.professor ? `Prof: ${event.professor}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const uid = `${event.id}-${event.day}-${event.startMinutes}@uoplan`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${localStamp(firstDay, event.startMinutes)}`,
      `DTEND:${localStamp(firstDay, event.endMinutes)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY_CODE[event.day]};UNTIL=${utcStamp(until)}`,
      `SUMMARY:${escapeText(summary)}`,
    );
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}
