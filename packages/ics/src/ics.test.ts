import { describe, expect, it } from "vitest";
import {
  buildCombinedScheduleIcs,
  buildImportantDatesIcs,
  buildScheduleIcs,
  ImportantDatesExportError,
} from "./ics";
import type { GeneratedSchedule } from "@uoplan/generation/generation/types";
import type { DataCache } from "@uoplan/domain/dataCache";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import type { ImportantDateItem, ImportantDateTerm } from "@uoplan/domain/dataTypes";

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

function makeItem(
  effect: ImportantDateItem["effect"],
  overrides: Partial<ImportantDateItem> = {},
): ImportantDateItem {
  return {
    id: "item-1",
    topic: "Untitled",
    dateText: "",
    effect,
    ...overrides,
  };
}

function makeTerm(sourceId: string, items: ImportantDateItem[]): ImportantDateTerm {
  return {
    sourceId,
    label: "Winter 2026",
    season: "winter",
    year: 2026,
    sourcePublished: "true",
    termInterval: { startDate: "2026-01-01", endDate: "2026-04-30" },
    courseInterval: { startDate: "2026-01-12", endDate: "2026-04-13" },
    sections: [
      { id: "s1", label: "Important Dates", category: "breaks", groups: [{ id: "g1", items }] },
    ],
    sessions: [],
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
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260417T000000Z;BYDAY=MO\r\n");
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

  it("stays source-compatible when importantDates is omitted (no enrichment)", () => {
    const ics = buildScheduleIcs({
      schedule: makeSchedule("CSI 2132"),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
    });

    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).not.toContain("EXDATE");
  });

  it("applies opted-in important-date transforms (mandatory closure + optional deadlines)", () => {
    const term = makeTerm("term-1", [
      makeItem("no_classes", {
        id: "family-day",
        topic: "Family Day",
        dateText: "February 16",
        interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
      }),
      makeItem("deadline", {
        id: "add-drop",
        topic: "Add/drop deadline",
        dateText: "January 23",
        interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
      }),
    ]);

    const ics = buildScheduleIcs({
      schedule: makeSchedule("CSI 2132"),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
      importantDates: { term, includeDeadlines: true },
    });

    // Course event + Family Day all-day marker + Add/drop deadline all-day marker.
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
    expect(ics).toContain("SUMMARY:Family Day\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260216\r\nDTEND;VALUE=DATE:20260217\r\n");
    expect(ics).toContain("SUMMARY:Add/drop deadline\r\n");
  });

  it("omits deadlines when includeDeadlines is not set, but still applies mandatory closures", () => {
    const term = makeTerm("term-1", [
      makeItem("no_classes", {
        id: "family-day",
        topic: "Family Day",
        dateText: "February 16",
        interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
      }),
      makeItem("deadline", {
        id: "add-drop",
        topic: "Add/drop deadline",
        dateText: "January 23",
        interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
      }),
    ]);

    const ics = buildScheduleIcs({
      schedule: makeSchedule("CSI 2132"),
      cache: makeCache(),
      startDate: "2026-01-12",
      endDate: "2026-04-15",
      importantDates: { term },
    });

    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
    expect(ics).not.toContain("Add/drop deadline");
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
    expect(ics).toContain("UNTIL=20251207T000000Z");
    expect(ics).toContain("UNTIL=20260417T000000Z");
    // UIDs are disambiguated by the segment key so the shared course doesn't collide.
    expect(ics).toContain("UID:2251-CSI 2132-LEC-Mo-540-600@uoplan");
    expect(ics).toContain("UID:2255-CSI 2132-LEC-Mo-540-600@uoplan");
  });

  it("produces an empty calendar for no segments", () => {
    const ics = buildCombinedScheduleIcs({ cache: makeCache(), segments: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("stays source-compatible when importantDates is omitted (no enrichment)", () => {
    const ics = buildCombinedScheduleIcs({
      cache: makeCache(),
      segments: [
        {
          key: "2251",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2025-09-03",
          endDate: "2025-12-05",
        },
        {
          key: "2255",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2026-01-12",
          endDate: "2026-04-15",
        },
      ],
    });

    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).not.toContain("EXDATE");
  });

  it("associates a matching important-date term per segment when opted in", () => {
    const fallTerm = makeTerm("fall-term", [
      makeItem("no_classes", {
        id: "fall-break",
        topic: "Fall break",
        dateText: "October 13",
        interval: { startDate: "2025-10-13", endDate: "2025-10-13" },
      }),
    ]);
    const winterTerm = makeTerm("winter-term", [
      makeItem("no_classes", {
        id: "family-day",
        topic: "Family Day",
        dateText: "February 16",
        interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
      }),
    ]);

    const ics = buildCombinedScheduleIcs({
      cache: makeCache(),
      segments: [
        {
          key: "2251",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2025-09-03",
          endDate: "2025-12-05",
        },
        {
          key: "2255",
          schedule: makeSchedule("CSI 2132"),
          startDate: "2026-01-12",
          endDate: "2026-04-15",
        },
      ],
      importantDates: { termsByKey: { "2251": fallTerm, "2255": winterTerm } },
    });

    // Two course events plus one all-day marker per segment — never the other segment's rule.
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(4);
    expect(ics).toContain("SUMMARY:Fall break\r\n");
    expect(ics).toContain("SUMMARY:Family Day\r\n");
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20251013T090000\r\n");
    expect(ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
  });

  it("throws a typed ImportantDatesExportError when a segment lacks a matching term", () => {
    const winterTerm = makeTerm("winter-term", []);

    let thrown: unknown;
    try {
      buildCombinedScheduleIcs({
        cache: makeCache(),
        segments: [
          {
            key: "2251",
            schedule: makeSchedule("CSI 2132"),
            startDate: "2025-09-03",
            endDate: "2025-12-05",
          },
          {
            key: "2255",
            schedule: makeSchedule("CSI 2132"),
            startDate: "2026-01-12",
            endDate: "2026-04-15",
          },
        ],
        // "2251" has no matching term even though mandatory enrichment was requested.
        importantDates: { termsByKey: { "2255": winterTerm } },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ImportantDatesExportError);
    expect((thrown as InstanceType<typeof ImportantDatesExportError>).code).toBe("missing-term");
    expect((thrown as Error).message).toContain("2251");
  });
});

describe("buildImportantDatesIcs", () => {
  it("renders every dated non-structural row as all-day events with exclusive DTEND, omitting structural and undated rows", () => {
    const term = makeTerm("term-1", [
      makeItem("no_classes", {
        id: "reading-week",
        topic: "Reading week",
        dateText: "February 16 to 20",
        interval: { startDate: "2026-02-16", endDate: "2026-02-20" },
      }),
      makeItem("deadline", {
        id: "add-drop",
        topic: "Add/drop deadline",
        dateText: "January 23",
        interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
      }),
      makeItem("informational", {
        id: "info-1",
        topic: "Reading list posted",
        dateText: "January 5",
        interval: { startDate: "2026-01-05", endDate: "2026-01-05" },
      }),
      makeItem("schedule_replacement", {
        id: "good-friday-swap",
        topic: "Friday schedule follows on Monday",
        dateText: "April 6",
        replacement: {
          cancelledDate: "2026-04-03",
          replacementDate: "2026-04-06",
          sourceDay: "Fr",
        },
      }),
      makeItem("structural", {
        id: "term-dates",
        topic: "Term dates",
        dateText: "January 1 to April 30",
        interval: { startDate: "2026-01-01", endDate: "2026-04-30" },
      }),
      makeItem("no_classes", { id: "tbd", topic: "TBD break", dateText: "" }),
    ]);

    const ics = buildImportantDatesIcs(term);

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(4);

    expect(ics).toContain("SUMMARY:Reading week\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260216\r\nDTEND;VALUE=DATE:20260221\r\n");

    expect(ics).toContain("SUMMARY:Add/drop deadline\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260123\r\nDTEND;VALUE=DATE:20260124\r\n");

    expect(ics).toContain("SUMMARY:Reading list posted\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260105\r\nDTEND;VALUE=DATE:20260106\r\n");

    // Schedule-change notice sits on the replacement date, not the cancelled date.
    expect(ics).toContain("SUMMARY:Friday schedule follows on Monday\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260406\r\nDTEND;VALUE=DATE:20260407\r\n");
    expect(ics).not.toContain("20260403");

    // Structural and undated rows are never rendered.
    expect(ics).not.toContain("Term dates");
    expect(ics).not.toContain("TBD break");
  });

  it("renders an empty calendar when the term has no dated non-structural rows", () => {
    const term = makeTerm("term-1", [
      makeItem("structural", {
        id: "term-dates",
        topic: "Term dates",
        dateText: "January 1 to April 30",
        interval: { startDate: "2026-01-01", endDate: "2026-04-30" },
      }),
    ]);

    const ics = buildImportantDatesIcs(term);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
