import type { ImportantDateInterval } from "@uoplan/domain/dataTypes";
import { describe, expect, it } from "vitest";
import type { CalendarEvent, TimedCalendarEvent } from "./ics";
import { matchEventToSession } from "./sessionMatching";
import type { ImportantDateSession } from "./sessionMatching";

// ---- fixtures ----

function interval(
  startDate: string,
  endDate: string,
  extra?: Partial<ImportantDateInterval>,
): ImportantDateInterval {
  return { startDate, endDate, ...extra };
}

function makeSession(code: string, courseInterval: ImportantDateInterval): ImportantDateSession {
  return { code, courseInterval };
}

function weeklyEvent(overrides: Partial<TimedCalendarEvent> = {}): TimedCalendarEvent {
  return {
    uid: "CSI2132-LEC-Mo-540-600@uoplan",
    summary: "CSI 2132",
    description: "Course: Data Structures, Algorithms",
    location: "STE 0134",
    time: {
      kind: "timed",
      date: "2026-01-12",
      startMinutes: 540,
      endMinutes: 600,
      timeZone: "America/Toronto",
    },
    recurrence: {
      frequency: "weekly",
      day: "Mo",
      untilDate: "2026-04-13",
      excludedDates: [],
    },
    ...overrides,
  };
}

describe("matchEventToSession", () => {
  const sessionA = makeSession("A", interval("2026-05-04", "2026-06-12"));
  const sessionB = makeSession("B", interval("2026-06-15", "2026-07-24"));

  function rangedWeeklyEvent(args: {
    uid?: string;
    date: string;
    untilDate: string;
    activeRange?: { startDate: string; endDate: string };
  }): TimedCalendarEvent {
    return weeklyEvent({
      uid: args.uid ?? "course@uoplan",
      time: {
        kind: "timed",
        date: args.date,
        startMinutes: 540,
        endMinutes: 600,
        timeZone: "America/Toronto",
      },
      recurrence: {
        frequency: "weekly",
        day: "Mo",
        untilDate: args.untilDate,
        excludedDates: [],
        ...(args.activeRange ? { activeRange: args.activeRange } : {}),
      },
    });
  }

  /** X overlaps a Jun1–Jun30 range by 10 days; Y overlaps it by 11 — Y should always win. */
  function overlapWinnerPair(): { x: ImportantDateSession; y: ImportantDateSession } {
    return {
      x: makeSession("X", interval("2026-05-15", "2026-06-10")),
      y: makeSession("Y", interval("2026-06-20", "2026-07-15")),
    };
  }

  it("classifies only timed weekly events — all-day and non-recurring timed events never match", () => {
    const allDay: CalendarEvent = {
      uid: "holiday@uoplan",
      summary: "Holiday",
      time: { kind: "all-day", startDate: "2026-05-04", endDate: "2026-06-12" },
    };
    expect(matchEventToSession(allDay, [sessionA, sessionB])).toBeUndefined();

    const oneOffTimed: TimedCalendarEvent = {
      uid: "copy@uoplan",
      summary: "Replacement copy",
      time: {
        kind: "timed",
        date: "2026-05-04",
        startMinutes: 540,
        endMinutes: 600,
        timeZone: "America/Toronto",
      },
    };
    expect(matchEventToSession(oneOffTimed, [sessionA, sessionB])).toBeUndefined();
  });

  it("prefers an exact start/end match over any other candidate", () => {
    const event = rangedWeeklyEvent({
      date: "2026-05-04",
      untilDate: "2026-06-12",
      activeRange: { startDate: "2026-05-04", endDate: "2026-06-12" },
    });

    expect(matchEventToSession(event, [sessionA, sessionB])).toBe("A");
  });

  it("falls back to the uniquely shortest fully-containing interval when there is no exact match", () => {
    const event = rangedWeeklyEvent({
      date: "2026-05-11",
      untilDate: "2026-06-05",
      activeRange: { startDate: "2026-05-11", endDate: "2026-06-05" },
    });
    const wideOuter = makeSession("WIDE", interval("2026-04-20", "2026-07-01"));
    const tightOuter = makeSession("TIGHT", interval("2026-05-01", "2026-06-15"));

    expect(matchEventToSession(event, [wideOuter, tightOuter])).toBe("TIGHT");
  });

  it("returns no match when the shortest fully-containing interval is tied", () => {
    const event = rangedWeeklyEvent({
      date: "2026-06-05",
      untilDate: "2026-06-10",
      activeRange: { startDate: "2026-06-05", endDate: "2026-06-10" },
    });
    // Both fully contain the event range and share the same 32-day duration.
    const p = makeSession("P", interval("2026-05-20", "2026-06-20"));
    const q = makeSession("Q", interval("2026-05-25", "2026-06-25"));

    expect(matchEventToSession(event, [p, q])).toBeUndefined();
  });

  it("falls back to the uniquely greatest positive inclusive day overlap when no interval fully contains the range", () => {
    const event = rangedWeeklyEvent({
      date: "2026-06-01",
      untilDate: "2026-06-30",
      activeRange: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });
    // Neither fully contains [Jun1, Jun30]; Y overlaps 11 days vs X's 10.
    const { x, y } = overlapWinnerPair();

    expect(matchEventToSession(event, [x, y])).toBe("Y");
  });

  it("returns no match for a tied overlap, and ignores non-overlapping (zero/negative overlap) sessions", () => {
    const event = rangedWeeklyEvent({
      date: "2026-06-01",
      untilDate: "2026-06-30",
      activeRange: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });
    const x2 = makeSession("X2", interval("2026-05-15", "2026-06-10")); // overlap 10
    const y2 = makeSession("Y2", interval("2026-06-21", "2026-07-20")); // overlap 10 (tie)
    const z = makeSession("Z", interval("2026-07-01", "2026-07-31")); // overlap 0

    expect(matchEventToSession(event, [x2, y2, z])).toBeUndefined();
  });

  it("uses recurrence.activeRange as the source range instead of {time.date, untilDate} when present", () => {
    // {time.date, untilDate} alone would describe a single day (2026-06-15),
    // but activeRange spans the full month and should be used instead.
    const event = rangedWeeklyEvent({
      date: "2026-06-15",
      untilDate: "2026-06-15",
      activeRange: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });
    const x = makeSession("X", interval("2026-05-15", "2026-06-10")); // overlap w/ full range: 10
    const y = makeSession("Y", interval("2026-06-20", "2026-07-15")); // overlap w/ full range: 11

    expect(matchEventToSession(event, [x, y])).toBe("Y");
  });

  it("falls back to {time.date, untilDate} for backward compatibility when activeRange is absent", () => {
    const event = rangedWeeklyEvent({ date: "2026-06-01", untilDate: "2026-06-30" });
    const { x, y } = overlapWinnerPair();

    expect(matchEventToSession(event, [x, y])).toBe("Y");
  });

  it("returns no match when there are no sessions to match against", () => {
    const event = rangedWeeklyEvent({ date: "2026-06-01", untilDate: "2026-06-30" });
    expect(matchEventToSession(event, [])).toBeUndefined();
  });
});
