import type { CalendarEvent } from "@uoplan/calendar/types";

import { buildScheduleIcs } from "@/lib/ics";

// Pure-JS RFC-5545 builder used by the native "Export to calendar" action (the
// web path uses Node-only ical-generator). Assert on the emitted VCALENDAR text.
function ev(
  partial: Pick<CalendarEvent, "id" | "courseCode" | "day"> & {
    startMinutes?: number;
    endMinutes?: number;
    componentSection?: string;
    professor?: string;
  },
): CalendarEvent {
  return {
    enrollmentIndex: 0,
    virtual: false,
    professor: "Staff",
    startMinutes: 600,
    endMinutes: 690,
    componentSection: "LEC A00",
    ...partial,
  } as CalendarEvent;
}

describe("buildScheduleIcs", () => {
  const events: CalendarEvent[] = [
    ev({ id: "iti-mon", courseCode: "ITI 1120", day: "Mo" }),
    ev({ id: "mat-tue", courseCode: "MAT 1320", day: "Tu", startMinutes: 510, endMinutes: 600 }),
  ];

  it("wraps events in a valid VCALENDAR envelope", () => {
    const ics = buildScheduleIcs({ events, startDate: "2025-09-03", endDate: "2025-12-05" });
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//uoplan//native//EN");
  });

  it("emits one weekly-recurring VEVENT per meeting", () => {
    const ics = buildScheduleIcs({ events, startDate: "2025-09-03", endDate: "2025-12-05" });
    const count = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(count).toBe(2);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("UNTIL=20251205T235959Z");
  });

  it("uses CRLF line endings", () => {
    const ics = buildScheduleIcs({ events, startDate: "2025-09-03", endDate: "2025-12-05" });
    expect(ics).toContain("\r\n");
  });

  it("places the first occurrence on/after the start date matching the weekday", () => {
    // 2025-09-03 is a Wednesday; the first Monday on/after is 2025-09-08.
    const ics = buildScheduleIcs({
      events: [ev({ id: "x", courseCode: "ITI 1120", day: "Mo" })],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });
    expect(ics).toContain("DTSTART:20250908T100000");
    expect(ics).toContain("DTEND:20250908T113000");
  });

  it("includes the course title and section in the event details", () => {
    const ics = buildScheduleIcs({
      events: [ev({ id: "x", courseCode: "ITI 1120", day: "Mo", professor: "Lapalme" })],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
      titleFor: () => "Introduction to Computing II",
    });
    expect(ics).toContain("SUMMARY:ITI 1120 — Introduction to Computing II");
    expect(ics).toContain("Section: LEC A00");
    expect(ics).toContain("Prof: Lapalme");
  });

  it("skips zero-length meetings and rejects invalid dates", () => {
    const ics = buildScheduleIcs({
      events: [
        ev({ id: "z", courseCode: "ITI 1120", day: "Mo", startMinutes: 600, endMinutes: 600 }),
      ],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(() => buildScheduleIcs({ events, startDate: "nope", endDate: "2025-12-05" })).toThrow();
  });
});
