import type { ImportantDateTerm } from "@uoplan/domain/dataTypes";
import { compareIsoDates, diffIsoDays, isIsoDate } from "./model";
import type { CalendarEvent, TimedCalendarEvent, WeeklyRecurrence } from "./model";

/** A single `spring-summer`-style scoped session, e.g. `{ code: "A", courseInterval }`. */
export type ImportantDateSession = ImportantDateTerm["sessions"][number];

/** Narrows a `CalendarEvent` to a timed, weekly-recurring event. */
export function hasWeeklyRecurrence(
  event: CalendarEvent,
): event is TimedCalendarEvent & { recurrence: WeeklyRecurrence } {
  return event.time.kind === "timed" && event.recurrence !== undefined;
}

/** An inclusive ISO date range, validated defensively (never throws). */
function validIsoRange(
  startDate: string,
  endDate: string,
): { startDate: string; endDate: string } | undefined {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return undefined;
  if (compareIsoDates(startDate, endDate) > 0) return undefined;
  return { startDate, endDate };
}

/**
 * The event's classification range: `recurrence.activeRange` when present
 * (the exact source meeting bounds), otherwise `{ time.date, recurrence.untilDate }`
 * for backward compatibility with events that predate `activeRange`.
 */
function eventSourceRange(
  event: TimedCalendarEvent & { recurrence: WeeklyRecurrence },
): { startDate: string; endDate: string } | undefined {
  if (event.recurrence.activeRange) {
    return validIsoRange(
      event.recurrence.activeRange.startDate,
      event.recurrence.activeRange.endDate,
    );
  }
  return validIsoRange(event.time.date, event.recurrence.untilDate);
}

/** Inclusive day overlap between two ISO ranges, or 0/negative when disjoint. */
function inclusiveOverlapDays(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
): number {
  const overlapStart = compareIsoDates(a.startDate, b.startDate) > 0 ? a.startDate : b.startDate;
  const overlapEnd = compareIsoDates(a.endDate, b.endDate) < 0 ? a.endDate : b.endDate;
  return diffIsoDays(overlapStart, overlapEnd) + 1;
}

/**
 * Deterministically classifies a schedule event against a term's `sessions`
 * (e.g. spring-summer's A/B/C sessions). Only timed weekly-recurring events
 * are classifiable — all-day events and one-off timed events (e.g.
 * `schedule_replacement` copies) never match. Priority order:
 *
 * 1. An exact start/end match against a session's `courseInterval` wins.
 * 2. Otherwise, among sessions whose `courseInterval` fully contains the
 *    event's range, the uniquely shortest interval wins.
 * 3. Otherwise, the session with the uniquely greatest positive inclusive
 *    day overlap wins.
 *
 * Ties (or zero/negative overlap) at any step return no match (`undefined`)
 * rather than guessing — callers must treat an unmatched event as ambiguous
 * and only apply global (unscoped) transformations to it.
 */
export function matchEventToSession(
  event: CalendarEvent,
  sessions: readonly ImportantDateSession[],
): string | undefined {
  if (sessions.length === 0) return undefined;
  if (!hasWeeklyRecurrence(event)) return undefined;

  const range = eventSourceRange(event);
  if (!range) return undefined;

  const validSessions = sessions
    .map((session) => ({
      code: session.code,
      interval: validIsoRange(session.courseInterval.startDate, session.courseInterval.endDate),
    }))
    .filter(
      (session): session is { code: string; interval: { startDate: string; endDate: string } } =>
        session.interval !== undefined,
    );
  if (validSessions.length === 0) return undefined;

  const exactMatches = validSessions.filter(
    (session) =>
      session.interval.startDate === range.startDate && session.interval.endDate === range.endDate,
  );
  if (exactMatches.length === 1) return exactMatches[0].code;

  const containing = validSessions.filter(
    (session) =>
      compareIsoDates(session.interval.startDate, range.startDate) <= 0 &&
      compareIsoDates(session.interval.endDate, range.endDate) >= 0,
  );
  if (containing.length > 0) {
    const durations = containing.map((session) => ({
      session,
      duration: diffIsoDays(session.interval.startDate, session.interval.endDate),
    }));
    const minDuration = Math.min(...durations.map((entry) => entry.duration));
    const shortest = durations.filter((entry) => entry.duration === minDuration);
    if (shortest.length === 1) return shortest[0].session.code;
  }

  const overlaps = validSessions
    .map((session) => ({
      code: session.code,
      overlap: inclusiveOverlapDays(range, session.interval),
    }))
    .filter((entry) => entry.overlap > 0);
  if (overlaps.length === 0) return undefined;

  const maxOverlap = Math.max(...overlaps.map((entry) => entry.overlap));
  const winners = overlaps.filter((entry) => entry.overlap === maxOverlap);
  return winners.length === 1 ? winners[0].code : undefined;
}
