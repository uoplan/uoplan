import { describe, expect, it } from "vitest";
import { buildCombinedScheduleIcs, buildScheduleIcs } from "./ics";
import type { GeneratedSchedule } from "@uoplan/generation/generation/types";
import type { DataCache } from "@uoplan/domain/dataCache";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

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
    getSchedule: () => {},
    getCoursesByDiscipline: () => [],
    getAllCourses: () => [],
    getAllSchedules: () => [],
    getFaculty: () => {},
    getFacultyForDiscipline: () => {},
    getDisciplinesByFaculty: () => [],
    getCoursesByFaculty: () => [],
  } as DataCache;
}

function makeSchedule(courseCode: string): GeneratedSchedule {
  return {
    enrollments: [
      {
        courseCode: normalizeCourseCode(courseCode),
        times: [{ day: "Mo", startMinutes: 540, endMinutes: 600 }],
        sectionCombo: {
          LEC: {
            section: {
              section: "A00-LEC",
              sectionCode: "A00",
              component: "LEC",
              session: null,
              times: [
                {
                  day: "Mo",
                  startMinutes: 540,
                  endMinutes: 600,
                  virtual: false,
                  instructor: "Prof, Name; Jr",
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

describe("buildScheduleIcs", () => {
  it("creates weekly recurring events with bounded UNTIL and escapes fields", () => {
    const sched = makeSchedule("CSI 2132");
    const cache = makeCache();

    const ics = buildScheduleIcs({
      schedule: sched,
      cache,
      startDate: "2026-01-12", // Monday
      endDate: "2026-04-15",
    });

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260415T000000Z\r\n");
    expect(ics).toContain("DTSTART;TZID=America/Toronto:20260112T090000\r\n");
    expect(ics).toContain("DTEND;TZID=America/Toronto:20260112T100000\r\n");
    expect(ics).toContain("SUMMARY:CSI 2132\r\n");
    // Commas/semicolons must be escaped in DESCRIPTION; allow iCalendar line-folding.
    expect(ics).toContain(
      "DESCRIPTION:Course: Data Structures\\, Algorithms\\nProf: Prof\\, Name\\; Jr\\n",
    );
    expect(ics).toContain("ection: LEC - A00\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});

describe("buildCombinedScheduleIcs", () => {
  it("merges multiple terms into one calendar with per-term UNTIL and unique UIDs", () => {
    const cache = makeCache();
    const ics = buildCombinedScheduleIcs({
      cache,
      segments: [
        {
          key: "2251",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2025-09-03", // Wednesday -> first Monday meeting 2025-09-08
          endDate: "2025-12-05",
        },
        {
          key: "2255",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2026-01-12", // Monday
          endDate: "2026-04-15",
        },
      ],
    });

    // Single calendar wrapper.
    expect(ics.match(/BEGIN:VCALENDAR/g)?.length).toBe(1);
    expect(ics.match(/END:VCALENDAR/g)?.length).toBe(1);
    // One event per term.
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    // Each term keeps its own recurrence window.
    expect(ics).toContain("UNTIL=20251205T000000Z");
    expect(ics).toContain("UNTIL=20260415T000000Z");
    // UIDs are disambiguated by the segment key so the shared course doesn't collide.
    expect(ics).toContain("UID:2251-CSI 2132-LEC-Mo-540-600@uoplan");
    expect(ics).toContain("UID:2255-CSI 2132-LEC-Mo-540-600@uoplan");
  });

  it("produces an empty calendar for no segments", () => {
    const ics = buildCombinedScheduleIcs({ cache: makeCache(), segments: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
