import { describe, expect, it } from "vitest";
import * as api from "./ics";

type RenderCalendarEvents = (events: unknown[], options?: unknown) => string;

function getRenderCalendarEvents(): RenderCalendarEvents {
  const fn = (api as Record<string, unknown>).renderCalendarEvents;
  expect(fn).toBeTypeOf("function");
  return fn as RenderCalendarEvents;
}

describe("renderCalendarEvents", () => {
  it("renders timed one-off events with stable UIDs", () => {
    const renderCalendarEvents = getRenderCalendarEvents();

    const ics = renderCalendarEvents([
      {
        uid: "one-off@uoplan",
        summary: "CSI 2132",
        description: "Course: Data Structures",
        location: "STE 0134",
        time: {
          kind: "timed",
          date: "2026-01-12",
          startMinutes: 540,
          endMinutes: 600,
          timeZone: "America/Toronto",
        },
      },
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("UID:one-off@uoplan\r\n");
    expect(ics).toContain("DTSTART;TZID=America/Toronto:20260112T090000\r\n");
    expect(ics).toContain("DTEND;TZID=America/Toronto:20260112T100000\r\n");
    expect(ics).not.toContain("RRULE:");
  });

  it("renders weekly recurring timed events with RRULE and EXDATE", () => {
    const renderCalendarEvents = getRenderCalendarEvents();

    const ics = renderCalendarEvents([
      {
        uid: "weekly@uoplan",
        summary: "CSI 2132",
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
          untilDate: "2026-02-16",
          excludedDates: ["2026-01-26", "2026-02-09"],
        },
      },
    ]);

    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260218T000000Z;BYDAY=MO\r\n");
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20260126T090000,20260209T090000\r\n");
  });

  it("renders weekly UNTIL two UTC midnights later so final Halifax occurrences are included", () => {
    const renderCalendarEvents = getRenderCalendarEvents();

    const ics = renderCalendarEvents([
      {
        uid: "halifax-weekly@uoplan",
        summary: "CSI 2132",
        time: {
          kind: "timed",
          date: "2026-01-14",
          startMinutes: 600,
          endMinutes: 660,
          timeZone: "America/Halifax",
        },
        recurrence: {
          frequency: "weekly",
          day: "We",
          untilDate: "2026-02-25",
          excludedDates: [],
        },
      },
    ]);

    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260227T000000Z;BYDAY=WE\r\n");
    expect(ics).not.toContain("RRULE:FREQ=WEEKLY;UNTIL=20260226T000000Z;BYDAY=WE\r\n");
  });

  it("renders weekly UNTIL two UTC midnights later so late Toronto occurrences are included", () => {
    const renderCalendarEvents = getRenderCalendarEvents();

    const ics = renderCalendarEvents([
      {
        uid: "toronto-evening@uoplan",
        summary: "CSI 2132",
        time: {
          kind: "timed",
          date: "2026-01-12",
          startMinutes: 1200,
          endMinutes: 1260,
          timeZone: "America/Toronto",
        },
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-02-23",
          excludedDates: [],
        },
      },
    ]);

    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260225T000000Z;BYDAY=MO\r\n");
    expect(ics).not.toContain("RRULE:FREQ=WEEKLY;UNTIL=20260224T000000Z;BYDAY=MO\r\n");
  });

  it("renders all-day events using exclusive DTEND for one-day and multi-day spans", () => {
    const renderCalendarEvents = getRenderCalendarEvents();

    const ics = renderCalendarEvents([
      {
        uid: "single-day@uoplan",
        summary: "Family Day",
        time: {
          kind: "all-day",
          startDate: "2026-02-16",
          endDate: "2026-02-16",
        },
      },
      {
        uid: "reading-week@uoplan",
        summary: "Reading Week",
        time: {
          kind: "all-day",
          startDate: "2026-02-16",
          endDate: "2026-02-20",
        },
      },
    ]);

    expect(ics).toContain("UID:single-day@uoplan\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260216\r\nDTEND;VALUE=DATE:20260217\r\n");
    expect(ics).toContain("UID:reading-week@uoplan\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260216\r\nDTEND;VALUE=DATE:20260221\r\n");
  });
});
