import type { CalendarEvent } from "@uoplan/calendar/types";

import { buildCalendarEventSpecs } from "@/lib/add-to-calendar";

function ev(
  partial: Pick<CalendarEvent, "id" | "courseCode" | "day"> & {
    startMinutes?: number;
    endMinutes?: number;
    componentSection?: string;
    professor?: string;
    location?: string;
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

function parts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

describe("buildCalendarEventSpecs", () => {
  it("returns one spec per non-empty schedule meeting", () => {
    const specs = buildCalendarEventSpecs({
      events: [
        ev({ id: "iti-mon", courseCode: "ITI 1120", day: "Mo" }),
        ev({ id: "mat-tue", courseCode: "MAT 1320", day: "Tu" }),
        ev({
          id: "bad-zero",
          courseCode: "BAD 1000",
          day: "We",
          startMinutes: 600,
          endMinutes: 600,
        }),
      ],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });

    expect(specs.map((spec) => spec.title)).toEqual(["ITI 1120", "MAT 1320"]);
  });

  it("places the first weekly occurrence on the matching weekday on or after term start", () => {
    const [spec] = buildCalendarEventSpecs({
      events: [ev({ id: "iti-mon", courseCode: "ITI 1120", day: "Mo" })],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });

    expect(spec.weekdayIso).toBe(1);
    expect(parts(spec.startDate)).toEqual({
      year: 2025,
      month: 9,
      day: 8,
      hour: 10,
      minute: 0,
      second: 0,
    });
    expect(parts(spec.endDate)).toEqual({
      year: 2025,
      month: 9,
      day: 8,
      hour: 11,
      minute: 30,
      second: 0,
    });
  });

  it("uses the start date itself when it already matches the event weekday", () => {
    const [spec] = buildCalendarEventSpecs({
      events: [ev({ id: "wed", courseCode: "CSI 2101", day: "We" })],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });

    expect(spec.weekdayIso).toBe(3);
    expect(parts(spec.startDate)).toMatchObject({ year: 2025, month: 9, day: 3 });
  });

  it("sets the recurrence boundary to the inclusive end of the term end date", () => {
    const [spec] = buildCalendarEventSpecs({
      events: [ev({ id: "fri", courseCode: "SEG 2105", day: "Fr" })],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
    });

    expect(parts(spec.recurrenceEndDate)).toEqual({
      year: 2025,
      month: 12,
      day: 5,
      hour: 23,
      minute: 59,
      second: 59,
    });
  });

  it("composes title, location, and notes from the schedule event", () => {
    const [spec] = buildCalendarEventSpecs({
      events: [
        ev({
          id: "iti-mon",
          courseCode: "ITI 1120",
          day: "Mo",
          componentSection: "LEC A00",
          professor: "Lapalme",
          location: "SITE 0104",
        }),
      ],
      startDate: "2025-09-03",
      endDate: "2025-12-05",
      titleFor: () => " Introduction to Computing II ",
    });

    expect(spec.title).toBe("ITI 1120 — Introduction to Computing II");
    expect(spec.location).toBe("SITE 0104");
    expect(spec.notes).toBe("Section: LEC A00\nProf: Lapalme");
  });
});
