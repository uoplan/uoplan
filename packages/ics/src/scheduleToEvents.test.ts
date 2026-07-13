import { describe, expect, it } from "vitest";
import * as api from "./ics";
import type { DataCache } from "@uoplan/domain/dataCache";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import type { GeneratedSchedule } from "@uoplan/generation/generation/types";

type ScheduleEventLike = {
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  time: {
    timeZone?: string;
    date: string;
  };
  recurrence?: {
    untilDate: string;
    day: string;
    activeRange?: { startDate: string; endDate: string };
  };
};

type ScheduleToCalendarEvents = (args: unknown) => ScheduleEventLike[];

function getScheduleToCalendarEvents(): ScheduleToCalendarEvents {
  const fn = (api as Record<string, unknown>).scheduleToCalendarEvents;
  expect(fn).toBeTypeOf("function");
  return fn as ScheduleToCalendarEvents;
}

function makeCache(): DataCache {
  return {
    getCourse: (code) => {
      if (code === normalizeCourseCode("CSI 2132")) {
        return {
          code: normalizeCourseCode("CSI 2132"),
          title: "Data Structures, Algorithms",
          credits: 3,
          description: "",
          component: "Lecture",
        };
      }
      return;
    },
    resolveToCanonical: (code) => normalizeCourseCode(code),
    getSchedule: (code) => {
      if (code === normalizeCourseCode("CSI 2132")) {
        return {
          subject: "CSI",
          catalogNumber: "2132",
          courseCode: normalizeCourseCode("CSI 2132"),
          title: "Data Structures, Algorithms",
          timeZone: "America/Halifax",
          components: {},
        };
      }
      return;
    },
    getCoursesByDiscipline: () => [],
    getAllCourses: () => [],
    getAllSchedules: () => [],
    getFaculty: () => {},
    getFacultyForDiscipline: () => {},
    getDisciplinesByFaculty: () => [],
    getCoursesByFaculty: () => [],
  } as DataCache;
}

function makeSchedule(): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode: normalizeCourseCode("CSI 2132"),
        times: [],
        sectionCombo: {
          LEC: {
            section: {
              section: "STE 0134 A00-LEC",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              times: [
                {
                  day: "We",
                  startMinutes: 600,
                  endMinutes: 660,
                  virtual: false,
                  instructor: "Prof, Name; Jr",
                  meetingDates: ["2026-01-14", "2026-02-25"],
                },
                {
                  day: "Mo",
                  startMinutes: 540,
                  endMinutes: 600,
                  virtual: false,
                  instructor: "Prof, Name; Jr",
                  meetingDates: null,
                },
                {
                  day: "Fr",
                  startMinutes: 780,
                  endMinutes: 840,
                  virtual: false,
                  instructor: "Other Prof",
                  meetingDates: null,
                },
                {
                  day: "Tu",
                  startMinutes: 660,
                  endMinutes: 660,
                  virtual: false,
                  instructor: "Skipped Prof",
                  meetingDates: null,
                },
              ],
              status: null,
            },
          },
        },
      },
    ],
  };
}

describe("scheduleToCalendarEvents", () => {
  it("prefers per-meeting dates and falls back to segment bounds", () => {
    const scheduleToCalendarEvents = getScheduleToCalendarEvents();

    const events = scheduleToCalendarEvents({
      schedule: makeSchedule(),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });

    expect(events).toHaveLength(3);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: "CSI 2132-LEC-We-600-660@uoplan",
          time: expect.objectContaining({
            kind: "timed",
            date: "2026-01-14",
          }),
          recurrence: expect.objectContaining({
            untilDate: "2026-02-25",
            day: "We",
          }),
        }),
        expect.objectContaining({
          uid: "CSI 2132-LEC-Mo-540-600@uoplan",
          time: expect.objectContaining({
            kind: "timed",
            date: "2026-01-12",
          }),
          recurrence: expect.objectContaining({
            untilDate: "2026-04-15",
            day: "Mo",
          }),
        }),
        expect.objectContaining({
          uid: "CSI 2132-LEC-Fr-780-840@uoplan",
          time: expect.objectContaining({
            kind: "timed",
            date: "2026-01-16",
          }),
          recurrence: expect.objectContaining({
            untilDate: "2026-04-15",
            day: "Fr",
          }),
        }),
      ]),
    );
  });

  it("sets recurrence.activeRange to the exact source meeting bounds, distinct from the shifted first occurrence", () => {
    const scheduleToCalendarEvents = getScheduleToCalendarEvents();

    const events = scheduleToCalendarEvents({
      schedule: makeSchedule(),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });

    // Per-meeting dates: activeRange mirrors the validated meetingDates pair.
    expect(events.find((event) => event.uid === "CSI 2132-LEC-We-600-660@uoplan")).toMatchObject({
      recurrence: {
        activeRange: { startDate: "2026-01-14", endDate: "2026-02-25" },
      },
    });

    // Fallback segment bounds start on a Monday, so the Monday event's first
    // occurrence coincides with the segment start.
    expect(events.find((event) => event.uid === "CSI 2132-LEC-Mo-540-600@uoplan")).toMatchObject({
      time: expect.objectContaining({ date: "2026-01-12" }),
      recurrence: {
        activeRange: { startDate: "2026-01-12", endDate: "2026-04-15" },
      },
    });

    // The Friday event's first occurrence (2026-01-16) is shifted forward from
    // the segment start (2026-01-12) — activeRange must preserve the original
    // segment bounds, not the shifted first-occurrence date.
    const fridayEvent = events.find((event) => event.uid === "CSI 2132-LEC-Fr-780-840@uoplan");
    expect(fridayEvent).toMatchObject({
      time: expect.objectContaining({ date: "2026-01-16" }),
      recurrence: {
        activeRange: { startDate: "2026-01-12", endDate: "2026-04-15" },
      },
    });
    expect(fridayEvent?.recurrence?.activeRange?.startDate).not.toBe(fridayEvent?.time.date);
  });

  it("preserves metadata compatibility and allows per-term uid prefixes", () => {
    const scheduleToCalendarEvents = getScheduleToCalendarEvents();

    const fallEvents = scheduleToCalendarEvents({
      schedule: makeSchedule(),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
      uidPrefix: "2251-",
    });
    const winterEvents = scheduleToCalendarEvents({
      schedule: makeSchedule(),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
      uidPrefix: "2255-",
    });

    expect(fallEvents[0]).toMatchObject({
      summary: "CSI 2132 — STE 0134",
      description:
        "Course: Data Structures, Algorithms\nProf: Prof, Name; Jr, Other Prof, Skipped Prof\nSection: LEC - A00",
      location: "STE 0134",
    });
    expect(fallEvents[0]).toMatchObject({
      time: expect.objectContaining({ timeZone: "America/Halifax" }),
    });
    expect(fallEvents[0]).toMatchObject({
      uid: expect.stringMatching(/^2251-/),
    });
    expect(winterEvents[0]).toMatchObject({
      uid: expect.stringMatching(/^2255-/),
    });
    expect(fallEvents[0]?.uid).not.toBe(winterEvents[0]?.uid);
  });

  it("skips meetings whose minutes are invalid", () => {
    const scheduleToCalendarEvents = getScheduleToCalendarEvents();

    const events = scheduleToCalendarEvents({
      schedule: makeSchedule(),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });

    expect(events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uid: expect.stringContaining("-Tu-660-660@uoplan"),
        }),
      ]),
    );
  });
});
