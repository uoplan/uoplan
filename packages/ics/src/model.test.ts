import { describe, expect, it } from "vitest";
import * as api from "./ics";

type CanonicalizeCalendarEvent = (event: unknown) => unknown;

function getCanonicalizeCalendarEvent(): CanonicalizeCalendarEvent {
  const fn = (api as Record<string, unknown>).canonicalizeCalendarEvent;
  expect(fn).toBeTypeOf("function");
  return fn as CanonicalizeCalendarEvent;
}

function timedEvent(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    uid: "event-1@uoplan",
    summary: "CSI 2132",
    time: {
      kind: "timed",
      date: "2026-01-12",
      startMinutes: 540,
      endMinutes: 600,
      timeZone: "America/Toronto",
    },
    ...overrides,
  };
}

describe("canonicalizeCalendarEvent", () => {
  it("rejects malformed and impossible ISO dates", () => {
    const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

    expect(() =>
      canonicalizeCalendarEvent(
        timedEvent({
          time: {
            kind: "timed",
            date: "2026-1-12",
            startMinutes: 540,
            endMinutes: 600,
            timeZone: "America/Toronto",
          },
        }),
      ),
    ).toThrow(/date/i);

    expect(() =>
      canonicalizeCalendarEvent(
        timedEvent({
          time: {
            kind: "timed",
            date: "2026-02-30",
            startMinutes: 540,
            endMinutes: 600,
            timeZone: "America/Toronto",
          },
        }),
      ),
    ).toThrow(/date/i);
  });

  it("rejects reversed all-day ranges", () => {
    const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

    expect(() =>
      canonicalizeCalendarEvent({
        uid: "day-1@uoplan",
        summary: "Reading week",
        time: {
          kind: "all-day",
          startDate: "2026-02-22",
          endDate: "2026-02-16",
        },
      }),
    ).toThrow(/range|end/i);
  });

  it("rejects invalid and reversed minutes", () => {
    const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

    expect(() =>
      canonicalizeCalendarEvent(
        timedEvent({
          time: {
            kind: "timed",
            date: "2026-01-12",
            startMinutes: -1,
            endMinutes: 600,
            timeZone: "America/Toronto",
          },
        }),
      ),
    ).toThrow(/minute/i);

    expect(() =>
      canonicalizeCalendarEvent(
        timedEvent({
          time: {
            kind: "timed",
            date: "2026-01-12",
            startMinutes: 600,
            endMinutes: 600,
            timeZone: "America/Toronto",
          },
        }),
      ),
    ).toThrow(/minute|end/i);
  });

  it("rejects recurrence until before the first occurrence and mismatched weekdays", () => {
    const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

    expect(() =>
      canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-01-05",
          excludedDates: [],
        },
      }),
    ).toThrow(/until|before/i);

    expect(() =>
      canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Tu",
          untilDate: "2026-02-16",
          excludedDates: [],
        },
      }),
    ).toThrow(/day|weekday/i);
  });

  it("canonicalizes duplicate exclusions deterministically and rejects invalid exclusions", () => {
    const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

    expect(
      canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-02-16",
          excludedDates: ["2026-02-02", "2026-01-19", "2026-02-02"],
        },
      }),
    ).toMatchObject({
      recurrence: {
        excludedDates: ["2026-01-19", "2026-02-02"],
      },
    });

    expect(() =>
      canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-02-16",
          excludedDates: ["2026-01-19", "2026-02-30"],
        },
      }),
    ).toThrow(/exclude|date/i);
  });

  describe("recurrence.activeRange", () => {
    it("is undefined by default (backward-compatible) when omitted", () => {
      const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

      const event = canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-02-16",
          excludedDates: [],
        },
      });

      expect(event).toMatchObject({
        recurrence: { activeRange: undefined },
      });
    });

    it("preserves a valid activeRange verbatim", () => {
      const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

      const event = canonicalizeCalendarEvent({
        ...timedEvent(),
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-02-16",
          excludedDates: [],
          activeRange: { startDate: "2026-01-05", endDate: "2026-03-01" },
        },
      });

      expect(event).toMatchObject({
        recurrence: {
          activeRange: { startDate: "2026-01-05", endDate: "2026-03-01" },
        },
      });
    });

    it("rejects a malformed or reversed activeRange", () => {
      const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

      expect(() =>
        canonicalizeCalendarEvent({
          ...timedEvent(),
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-02-16",
            excludedDates: [],
            activeRange: { startDate: "2026-02-30", endDate: "2026-03-01" },
          },
        }),
      ).toThrow(/date/i);

      expect(() =>
        canonicalizeCalendarEvent({
          ...timedEvent(),
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-02-16",
            excludedDates: [],
            activeRange: { startDate: "2026-03-01", endDate: "2026-01-05" },
          },
        }),
      ).toThrow(/range|end/i);
    });

    it("rejects an activeRange that does not contain the first occurrence", () => {
      const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

      // First occurrence (2026-01-12) is before the activeRange start.
      expect(() =>
        canonicalizeCalendarEvent({
          ...timedEvent(),
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-02-16",
            excludedDates: [],
            activeRange: { startDate: "2026-01-13", endDate: "2026-03-01" },
          },
        }),
      ).toThrow(/active range|first occurrence/i);

      // First occurrence (2026-01-12) is after the activeRange end.
      expect(() =>
        canonicalizeCalendarEvent({
          ...timedEvent(),
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-02-16",
            excludedDates: [],
            activeRange: { startDate: "2025-12-01", endDate: "2026-01-11" },
          },
        }),
      ).toThrow(/active range|first occurrence/i);
    });

    it("rejects an untilDate that exceeds the activeRange end date", () => {
      const canonicalizeCalendarEvent = getCanonicalizeCalendarEvent();

      expect(() =>
        canonicalizeCalendarEvent({
          ...timedEvent(),
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-03-02",
            excludedDates: [],
            activeRange: { startDate: "2026-01-05", endDate: "2026-03-01" },
          },
        }),
      ).toThrow(/active range|until/i);
    });
  });
});

describe("diffIsoDays", () => {
  function getDiffIsoDays(): (startDate: string, endDate: string) => number {
    const fn = (api as Record<string, unknown>).diffIsoDays;
    expect(fn).toBeTypeOf("function");
    return fn as (startDate: string, endDate: string) => number;
  }

  it("computes the inclusive-agnostic day delta without host-timezone-dependent math", () => {
    const diffIsoDays = getDiffIsoDays();

    expect(diffIsoDays("2026-01-01", "2026-01-01")).toBe(0);
    expect(diffIsoDays("2026-01-01", "2026-01-02")).toBe(1);
    expect(diffIsoDays("2026-01-01", "2026-02-01")).toBe(31);
    // Reversed range yields a negative delta rather than throwing.
    expect(diffIsoDays("2026-01-02", "2026-01-01")).toBe(-1);
  });

  it("throws for invalid ISO dates", () => {
    const diffIsoDays = getDiffIsoDays();
    expect(() => diffIsoDays("2026-02-30", "2026-03-01")).toThrow(/date/i);
  });
});
