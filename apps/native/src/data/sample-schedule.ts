import type { CalendarEvent } from "@uoplan/calendar/types";

/**
 * A realistic conflict-free first-year CS week, used to demo the native
 * {@link WeekCalendar} until the real generation engine + data transport land.
 * Only the fields the read-only calendar renders are meaningful; branded
 * identity fields are filled with safe placeholders.
 */
function ev(
  partial: Pick<
    CalendarEvent,
    "id" | "courseCode" | "day" | "startMinutes" | "endMinutes" | "componentSection"
  > & { professor?: string },
): CalendarEvent {
  const { professor, ...rest } = partial;
  return {
    enrollmentIndex: 0,
    virtual: false,
    professor: (professor ?? "Staff") as CalendarEvent["professor"],
    ...rest,
  };
}

const H = (hour: number, minute = 0) => hour * 60 + minute;

export const SAMPLE_SCHEDULE: CalendarEvent[] = [
  // ITI 1120 — Introduction to Computing II
  ev({
    id: "iti-mon",
    courseCode: "ITI 1120",
    day: "Mo",
    startMinutes: H(10),
    endMinutes: H(11, 30),
    componentSection: "LEC A00",
    professor: "Lapalme",
  }),
  ev({
    id: "iti-wed",
    courseCode: "ITI 1120",
    day: "We",
    startMinutes: H(10),
    endMinutes: H(11, 30),
    componentSection: "LEC A00",
    professor: "Lapalme",
  }),
  ev({
    id: "iti-lab",
    courseCode: "ITI 1120",
    day: "Fr",
    startMinutes: H(13),
    endMinutes: H(14, 30),
    componentSection: "LAB A01",
    professor: "Staff",
  }),

  // MAT 1320 — Calculus I
  ev({
    id: "mat-tue",
    courseCode: "MAT 1320",
    day: "Tu",
    startMinutes: H(8, 30),
    endMinutes: H(10),
    componentSection: "LEC B00",
    professor: "Mayer",
  }),
  ev({
    id: "mat-thu",
    courseCode: "MAT 1320",
    day: "Th",
    startMinutes: H(8, 30),
    endMinutes: H(10),
    componentSection: "LEC B00",
    professor: "Mayer",
  }),

  // CSI 2110 — Data Structures and Algorithms
  ev({
    id: "csi-mon",
    courseCode: "CSI 2110",
    day: "Mo",
    startMinutes: H(13),
    endMinutes: H(14, 30),
    componentSection: "LEC C00",
    professor: "Nayak",
  }),
  ev({
    id: "csi-wed",
    courseCode: "CSI 2110",
    day: "We",
    startMinutes: H(13),
    endMinutes: H(14, 30),
    componentSection: "LEC C00",
    professor: "Nayak",
  }),

  // PHY 1124 — Fundamentals of Physics
  ev({
    id: "phy-thu",
    courseCode: "PHY 1124",
    day: "Th",
    startMinutes: H(11, 30),
    endMinutes: H(13),
    componentSection: "LEC D00",
    professor: "Tremblay",
  }),

  // ADM 1100 — Introduction to Business Management
  ev({
    id: "adm-tue",
    courseCode: "ADM 1100",
    day: "Tu",
    startMinutes: H(16),
    endMinutes: H(17, 30),
    componentSection: "LEC E00",
    professor: "Roy",
  }),
];
