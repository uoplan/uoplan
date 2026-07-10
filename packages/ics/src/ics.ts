import ical, { ICalEventRepeatingFreq } from "ical-generator";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { GeneratedSchedule } from "@uoplan/generation/generation/types";
import type { DayOfWeek } from "@uoplan/domain/dataTypes";

const DEFAULT_TZID = "America/Toronto";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseIsoDate(date: string): { y: number; m: number; d: number } | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function utcDateFromIso(date: string): Date | null {
  const parts = parseIsoDate(date);
  if (!parts) return null;
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0));
}

function addUtcDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function dayToIsoIndex(day: DayOfWeek): number {
  // Monday=1 .. Sunday=7
  switch (day) {
    case "Mo":
      return 1;
    case "Tu":
      return 2;
    case "We":
      return 3;
    case "Th":
      return 4;
    case "Fr":
      return 5;
    case "Sa":
      return 6;
    case "Su":
      return 7;
  }
}

function jsUtcDayToIsoIndex(jsUtcDay: number): number {
  // JS: 0=Sun..6=Sat -> ISO: 1=Mon..7=Sun
  if (jsUtcDay === 0) return 7;
  return jsUtcDay;
}

/**
 * Build a naive (timezone-less) ISO date-time string for a wall-clock time.
 * `ical-generator` interprets this as a local time in the event's timezone,
 * preserving the exact wall-clock value regardless of the host's timezone.
 */
function naiveLocalIso(dateUtcMidnight: Date, minutes: number): string {
  const y = dateUtcMidnight.getUTCFullYear();
  const mo = pad2(dateUtcMidnight.getUTCMonth() + 1);
  const d = pad2(dateUtcMidnight.getUTCDate());
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${y}-${mo}-${d}T${pad2(hours)}:${pad2(mins)}:00`;
}

function uniqNonEmpty(parts: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const p of parts) {
    const t = (p ?? "").trim();
    if (t) set.add(t);
  }
  return [...set];
}

function pickLocation(sectionText: string): string | null {
  const raw = (sectionText ?? "").trim();
  if (!raw) return null;

  // Best-effort: look for common "BLDG 1234" or "BLDG-1234" patterns.
  // Avoid component tokens like LEC/LAB/REC.
  const m = raw.match(/\b([A-Z]{2,6})\s*[-]?\s*(\d{2,4}[A-Z]?)\b/);
  if (!m) return null;
  const building = m[1];
  const room = m[2];
  const banned = new Set(["LEC", "LAB", "REC", "TUT", "SEM", "DGD", "PRA", "CLI"]);
  if (banned.has(building)) return null;
  return `${building} ${room}`;
}

type ICalendar = ReturnType<typeof ical>;

/**
 * Resolve a start/end ISO date pair to the UTC-midnight start date and the
 * `UNTIL` bound `ical-generator` expects. Throws when either date is malformed.
 */
function resolveDateRange(startDate: string, endDate: string): { start: Date; until: Date } {
  const start = utcDateFromIso(startDate);
  const end = utcDateFromIso(endDate);
  if (!start || !end) {
    throw new Error("Invalid date range for iCalendar export");
  }
  // UTC midnight on the end date, matching the original export's UNTIL format.
  const until = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0),
  );
  return { start, until };
}

/**
 * Append every meeting of a schedule to an existing calendar as weekly-repeating
 * VEVENTs anchored to `start` and repeating until `until`. `uidPrefix`
 * disambiguates UIDs when several schedules (e.g. multiple planned terms) are
 * merged into one calendar so the same course in two terms never collides.
 */
function addScheduleEvents(
  calendar: ICalendar,
  schedule: GeneratedSchedule,
  cache: DataCache | null,
  start: Date,
  until: Date,
  uidPrefix = "",
): void {
  for (const enrollment of schedule.enrollments) {
    const courseCode = enrollment.courseCode;
    const courseTitle =
      cache?.getCourse(courseCode)?.title?.trim() ||
      cache?.getSchedule(courseCode)?.title?.trim() ||
      "";

    const courseTzid = cache?.getSchedule(courseCode)?.timeZone || DEFAULT_TZID;

    for (const [component, { section }] of Object.entries(enrollment.sectionCombo)) {
      const instructors = uniqNonEmpty(
        section.times.map((t) => t.instructor).filter((i): i is string => i !== null),
      );
      const professor = instructors.length > 0 ? instructors.join(", ") : "—";
      const sectionCode = (section.sectionCode ?? section.section ?? "").trim();
      const sectionLabel = sectionCode ? `${component} - ${sectionCode}` : component;

      const location = pickLocation(section.section);
      const summary = `${courseCode}${location ? ` — ${location}` : ""}`;
      const description = [
        courseTitle ? `Course: ${courseTitle}` : null,
        professor ? `Prof: ${professor}` : null,
        sectionLabel ? `Section: ${sectionLabel}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      for (const t of section.times ?? []) {
        if (t.startMinutes >= t.endMinutes) continue;

        const startIsoDow = dayToIsoIndex(t.day);
        const startDow = jsUtcDayToIsoIndex(start.getUTCDay());
        const delta = (startIsoDow - startDow + 7) % 7;
        const firstDay = addUtcDays(start, delta);

        const uid = `${uidPrefix}${courseCode}-${component}-${t.day}-${t.startMinutes}-${t.endMinutes}@uoplan`;

        calendar.createEvent({
          id: uid,
          start: naiveLocalIso(firstDay, t.startMinutes),
          end: naiveLocalIso(firstDay, t.endMinutes),
          timezone: courseTzid,
          summary,
          description: description || undefined,
          location: location || undefined,
          repeating: {
            freq: ICalEventRepeatingFreq.WEEKLY,
            until,
          },
        });
      }
    }
  }
}

export function buildScheduleIcs(args: {
  schedule: GeneratedSchedule;
  cache: DataCache | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}): string {
  const { schedule, cache, startDate, endDate } = args;
  const { start, until } = resolveDateRange(startDate, endDate);

  const calendar = ical({ prodId: "//uoplan//EN" });
  addScheduleEvents(calendar, schedule, cache, start, until);
  return calendar.toString();
}

/** One planned term's schedule plus its own date range for a combined export. */
export interface CombinedScheduleSegment {
  schedule: GeneratedSchedule;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  /**
   * Stable per-segment discriminator (e.g. the term id) folded into every UID so
   * the same course appearing in two terms yields distinct events.
   */
  key: string;
}

/**
 * Build a single iCalendar covering several planned terms. Each segment keeps
 * its own recurrence window (`UNTIL`) so a fall course doesn't bleed into the
 * winter term, and its `key` disambiguates UIDs across terms.
 */
export function buildCombinedScheduleIcs(args: {
  segments: CombinedScheduleSegment[];
  cache: DataCache | null;
}): string {
  const { segments, cache } = args;
  const calendar = ical({ prodId: "//uoplan//EN" });
  for (const segment of segments) {
    const { start, until } = resolveDateRange(segment.startDate, segment.endDate);
    addScheduleEvents(calendar, segment.schedule, cache, start, until, `${segment.key}-`);
  }
  return calendar.toString();
}
