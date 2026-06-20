import type { CalendarEvent } from "@uoplan/calendar/types";

import { dedupeWeeklySlots } from "@/components/week-calendar";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    courseCode: "FRA 1710",
    enrollmentIndex: 0,
    day: "Mo",
    startMinutes: 19 * 60,
    endMinutes: 20 * 60 + 20,
    componentSection: "LEC - A00",
    virtual: false,
    professor: "" as CalendarEvent["professor"],
    meetingDates: null,
    ...overrides,
  };
}

describe("dedupeWeeklySlots", () => {
  it("collapses registrar date segments for the same weekly slot", () => {
    const result = dedupeWeeklySlots([
      event({ id: "fra-segment-1", meetingDates: ["2027-01-11", "2027-02-21"] }),
      event({ id: "fra-segment-2", meetingDates: ["2027-02-22", "2027-02-22"] }),
      event({ id: "fra-segment-3", meetingDates: ["2027-02-23", "2027-04-14"] }),
      event({
        id: "mat-lecture",
        courseCode: "MAT 1320",
        startMinutes: 10 * 60,
        endMinutes: 11 * 60 + 30,
        meetingDates: ["2027-01-11", "2027-04-14"],
      }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "fra-segment-1",
      meetingDates: ["2027-01-11", "2027-04-14"],
    });
    expect(result[1]?.id).toBe("mat-lecture");
  });

  it("keeps different-time meetings for the same course separate", () => {
    const result = dedupeWeeklySlots([
      event({ id: "fra-evening", startMinutes: 19 * 60, endMinutes: 20 * 60 + 20 }),
      event({ id: "fra-afternoon", startMinutes: 14 * 60, endMinutes: 15 * 60 + 20 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["fra-evening", "fra-afternoon"]);
  });
});
