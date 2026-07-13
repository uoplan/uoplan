import type {
  ImportantDateGroup,
  ImportantDateInterval,
  ImportantDateItem,
  ImportantDateSection,
  ImportantDateTerm,
  ScheduleReplacement,
} from "@uoplan/domain/dataTypes";
import { describe, expect, it } from "vitest";
import * as api from "./ics";
import type { CalendarEvent, TimedCalendarEvent } from "./ics";

type ApplyImportantDateTransforms = (
  events: readonly CalendarEvent[],
  term: ImportantDateTerm,
  options?: { includeDeadlines?: boolean },
) => CalendarEvent[];

type ImportantDateTermToCalendarEvents = (term: ImportantDateTerm) => CalendarEvent[];

function getApplyImportantDateTransforms(): ApplyImportantDateTransforms {
  const fn = (api as Record<string, unknown>).applyImportantDateTransforms;
  expect(fn).toBeTypeOf("function");
  return fn as ApplyImportantDateTransforms;
}

function getImportantDateTermToCalendarEvents(): ImportantDateTermToCalendarEvents {
  const fn = (api as Record<string, unknown>).importantDateTermToCalendarEvents;
  expect(fn).toBeTypeOf("function");
  return fn as ImportantDateTermToCalendarEvents;
}

function getImportantDatesExportError(): new (message: string, code: string) => Error {
  const ctor = (api as Record<string, unknown>).ImportantDatesExportError;
  expect(ctor).toBeTypeOf("function");
  return ctor as new (message: string, code: string) => Error;
}

// ---- fixtures ----

function interval(
  startDate: string,
  endDate: string,
  extra?: Partial<ImportantDateInterval>,
): ImportantDateInterval {
  return { startDate, endDate, ...extra };
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

function makeTerm(
  items: ImportantDateItem[],
  overrides: Partial<ImportantDateTerm> = {},
): ImportantDateTerm {
  const defaultSections: ImportantDateSection[] = [
    {
      id: "section-1",
      label: "Important Dates",
      category: "breaks",
      groups: [{ id: "group-1", items }],
    },
  ];

  return {
    sourceId: "9221_158141",
    termId: "2261",
    label: "Winter 2026",
    season: "winter",
    year: 2026,
    sourcePublished: "true",
    termInterval: interval("2026-01-01", "2026-04-30"),
    courseInterval: interval("2026-01-12", "2026-04-13"),
    sections: defaultSections,
    sessions: [],
    ...overrides,
  };
}

/** A `spring-summer`-style scoped session — `{ code, courseInterval }`. */
type ImportantDateSession = ImportantDateTerm["sessions"][number];

function makeSession(code: string, courseInterval: ImportantDateInterval): ImportantDateSession {
  return { code, courseInterval };
}

function makeGroup(
  items: ImportantDateItem[],
  overrides: Partial<ImportantDateGroup> = {},
): ImportantDateGroup {
  return { id: "group-1", items, ...overrides };
}

/** A single-section term whose groups (and their scoping) are fully controlled by the caller. */
function makeSessionTerm(args: {
  sessions: ImportantDateSession[];
  groups: ImportantDateGroup[];
  overrides?: Partial<ImportantDateTerm>;
}): ImportantDateTerm {
  return makeTerm([], {
    sessions: args.sessions,
    sections: [
      {
        id: "section-1",
        label: "Important Dates",
        category: "breaks",
        groups: args.groups,
      },
    ],
    ...args.overrides,
  });
}

function replacementRule(overrides: Partial<ScheduleReplacement> = {}): ScheduleReplacement {
  return {
    cancelledDate: "2026-04-03",
    replacementDate: "2026-04-06",
    sourceDay: "Fr",
    ...overrides,
  };
}

function makeReplacementTerm(overrides: Partial<ImportantDateTerm> = {}): ImportantDateTerm {
  return makeTerm(
    [
      makeItem("schedule_replacement", {
        id: "good-friday-swap",
        topic: "Friday schedule follows on Monday",
        dateText: "April 6",
        replacement: replacementRule(),
      }),
    ],
    overrides,
  );
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("applyImportantDateTransforms", () => {
  describe("no_classes", () => {
    it("adds an all-day event for a one-day holiday and excludes the matching weekly occurrence", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const wednesday = weeklyEvent({
        uid: "CSI2132-LEC-We-600-660@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-14",
          startMinutes: 600,
          endMinutes: 660,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "We", untilDate: "2026-04-15", excludedDates: [] },
      });
      const term = makeTerm([
        makeItem("no_classes", {
          id: "family-day",
          topic: "Family Day",
          dateText: "February 16",
          interval: interval("2026-02-16", "2026-02-16"),
        }),
      ]);

      const result = applyImportantDateTransforms([monday, wednesday], term);

      const allDay = result.find((event) => event.time.kind === "all-day");
      expect(allDay).toMatchObject({
        summary: "Family Day",
        time: { kind: "all-day", startDate: "2026-02-16", endDate: "2026-02-16" },
      });
      expect(allDay?.uid).toContain(term.sourceId);
      expect(allDay?.uid).toContain("family-day");

      expect(result.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-16"] },
      });
      expect(result.find((event) => event.uid === wednesday.uid)).toMatchObject({
        recurrence: { excludedDates: [] },
      });
    });

    it("excludes every matching weekly occurrence within a multi-day reading week", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const wednesday = weeklyEvent({
        uid: "CSI2132-LEC-We-600-660@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-14",
          startMinutes: 600,
          endMinutes: 660,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "We", untilDate: "2026-04-15", excludedDates: [] },
      });
      const friday = weeklyEvent({
        uid: "CSI2132-LEC-Fr-780-840@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-16",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "Fr", untilDate: "2026-04-17", excludedDates: [] },
      });
      const term = makeTerm([
        makeItem("no_classes", {
          id: "reading-week",
          topic: "Reading week",
          dateText: "February 16 to 20",
          interval: interval("2026-02-16", "2026-02-20"),
        }),
      ]);

      const result = applyImportantDateTransforms([monday, wednesday, friday], term);

      expect(result.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-16"] },
      });
      expect(result.find((event) => event.uid === wednesday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-18"] },
      });
      expect(result.find((event) => event.uid === friday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-20"] },
      });
      expect(result.filter((event) => event.time.kind === "all-day")).toHaveLength(1);
    });

    it("excludes only overlapping timed occurrences for a same-day timed closure (boundary cases)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const base = {
        date: "2026-01-12",
        timeZone: "America/Toronto",
      };
      const recurrence = {
        frequency: "weekly" as const,
        day: "Mo" as const,
        untilDate: "2026-04-13",
        excludedDates: [],
      };
      const events: TimedCalendarEvent[] = [
        weeklyEvent({
          uid: "before@uoplan",
          time: { kind: "timed", ...base, startMinutes: 480, endMinutes: 540 },
          recurrence,
        }),
        weeklyEvent({
          uid: "touching-start@uoplan",
          time: { kind: "timed", ...base, startMinutes: 540, endMinutes: 600 },
          recurrence,
        }),
        weeklyEvent({
          uid: "overlap-start@uoplan",
          time: { kind: "timed", ...base, startMinutes: 570, endMinutes: 630 },
          recurrence,
        }),
        weeklyEvent({
          uid: "inside@uoplan",
          time: { kind: "timed", ...base, startMinutes: 630, endMinutes: 690 },
          recurrence,
        }),
        weeklyEvent({
          uid: "overlap-end@uoplan",
          time: { kind: "timed", ...base, startMinutes: 870, endMinutes: 930 },
          recurrence,
        }),
        weeklyEvent({
          uid: "touching-end@uoplan",
          time: { kind: "timed", ...base, startMinutes: 900, endMinutes: 960 },
          recurrence,
        }),
        weeklyEvent({
          uid: "after@uoplan",
          time: { kind: "timed", ...base, startMinutes: 960, endMinutes: 1020 },
          recurrence,
        }),
      ];

      const term = makeTerm([
        makeItem("no_classes", {
          id: "storm",
          topic: "Winter storm closure",
          dateText: "March 2, 10 a.m. to 3 p.m.",
          interval: interval("2026-03-02", "2026-03-02", { startMinutes: 600, endMinutes: 900 }),
        }),
      ]);

      const result = applyImportantDateTransforms(events, term);
      const excludedUids = result
        .filter((event) => event.recurrence?.excludedDates.includes("2026-03-02"))
        .map((event) => event.uid)
        .sort();

      expect(excludedUids).toEqual(["inside@uoplan", "overlap-end@uoplan", "overlap-start@uoplan"]);
    });

    it("excludes only overlapping timed occurrences across a multi-day timed closure (start/interior/end boundaries)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const events: TimedCalendarEvent[] = [
        weeklyEvent({
          uid: "mon-before@uoplan",
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
        }),
        weeklyEvent({
          uid: "mon-after@uoplan",
          time: {
            kind: "timed",
            date: "2026-01-12",
            startMinutes: 1080,
            endMinutes: 1140,
            timeZone: "America/Toronto",
          },
          recurrence: {
            frequency: "weekly",
            day: "Mo",
            untilDate: "2026-04-13",
            excludedDates: [],
          },
        }),
        weeklyEvent({
          uid: "tue@uoplan",
          time: {
            kind: "timed",
            date: "2026-01-13",
            startMinutes: 600,
            endMinutes: 660,
            timeZone: "America/Toronto",
          },
          recurrence: {
            frequency: "weekly",
            day: "Tu",
            untilDate: "2026-04-14",
            excludedDates: [],
          },
        }),
        weeklyEvent({
          uid: "wed-touch@uoplan",
          time: {
            kind: "timed",
            date: "2026-01-14",
            startMinutes: 525,
            endMinutes: 585,
            timeZone: "America/Toronto",
          },
          recurrence: {
            frequency: "weekly",
            day: "We",
            untilDate: "2026-04-15",
            excludedDates: [],
          },
        }),
        weeklyEvent({
          uid: "wed-before@uoplan",
          time: {
            kind: "timed",
            date: "2026-01-14",
            startMinutes: 480,
            endMinutes: 540,
            timeZone: "America/Toronto",
          },
          recurrence: {
            frequency: "weekly",
            day: "We",
            untilDate: "2026-04-15",
            excludedDates: [],
          },
        }),
        weeklyEvent({
          uid: "wed-after@uoplan",
          time: {
            kind: "timed",
            date: "2026-01-14",
            startMinutes: 600,
            endMinutes: 660,
            timeZone: "America/Toronto",
          },
          recurrence: {
            frequency: "weekly",
            day: "We",
            untilDate: "2026-04-15",
            excludedDates: [],
          },
        }),
      ];

      const term = makeTerm([
        makeItem("no_classes", {
          id: "holiday-break",
          topic: "Holiday break. University is closed.",
          dateText: "From 5 p.m. March 2 to 8:45 a.m. March 4",
          interval: interval("2026-03-02", "2026-03-04", { startMinutes: 1020, endMinutes: 525 }),
        }),
      ]);

      const result = applyImportantDateTransforms(events, term);
      const excludedFor = (uid: string) =>
        result.find((event) => event.uid === uid)?.recurrence?.excludedDates ?? [];

      expect(excludedFor("mon-before@uoplan")).toEqual([]);
      expect(excludedFor("mon-after@uoplan")).toEqual(["2026-03-02"]);
      expect(excludedFor("tue@uoplan")).toEqual(["2026-03-03"]);
      expect(excludedFor("wed-touch@uoplan")).toEqual([]);
      expect(excludedFor("wed-before@uoplan")).toEqual(["2026-03-04"]);
      expect(excludedFor("wed-after@uoplan")).toEqual([]);
    });

    it("deduplicates and sorts EXDATE values across overlapping no_classes rules, preserving existing exclusions", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent({
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-04-13",
          excludedDates: ["2026-01-19"],
        },
      });
      const term = makeTerm([
        makeItem("no_classes", {
          id: "reading-week",
          topic: "Reading week",
          dateText: "Feb 16 to 20",
          interval: interval("2026-02-16", "2026-02-20"),
        }),
        makeItem("no_classes", {
          id: "study-day",
          topic: "Extra study day",
          dateText: "Feb 16",
          interval: interval("2026-02-16", "2026-02-16"),
        }),
      ]);

      const result = applyImportantDateTransforms([monday], term);
      const updated = result.find((event) => event.uid === monday.uid);

      expect(updated?.recurrence?.excludedDates).toEqual(["2026-01-19", "2026-02-16"]);
      expect(result.filter((event) => event.time.kind === "all-day")).toHaveLength(2);
    });

    it("throws a typed ImportantDatesExportError for an invalid no_classes interval", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const ImportantDatesExportError = getImportantDatesExportError();

      const reversed = makeTerm([
        makeItem("no_classes", {
          id: "bad-break",
          topic: "Broken break",
          dateText: "n/a",
          interval: interval("2026-02-20", "2026-02-16"),
        }),
      ]);
      expect(() => applyImportantDateTransforms([weeklyEvent()], reversed)).toThrow(
        ImportantDatesExportError,
      );

      const malformed = makeTerm([
        makeItem("no_classes", {
          id: "bad-date",
          topic: "Broken break",
          dateText: "n/a",
          interval: interval("2026-02-30", "2026-02-30"),
        }),
      ]);
      expect(() => applyImportantDateTransforms([weeklyEvent()], malformed)).toThrow(
        ImportantDatesExportError,
      );
    });

    it("skips a no_classes row without an interval (undated)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const term = makeTerm([
        makeItem("no_classes", { id: "tbd", topic: "Dates TBD", dateText: "" }),
      ]);

      const result = applyImportantDateTransforms([monday], term);
      expect(result).toEqual([monday]);
    });
  });

  describe("schedule_replacement", () => {
    it("copies the source-day schedule onto the replacement date with identical summary/description/location/time/timezone", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const friday = weeklyEvent({
        uid: "PHY1101-LEC-Fr-780-840@uoplan",
        summary: "PHY 1101",
        description: "Course: Physics I",
        location: "STE 0128",
        time: {
          kind: "timed",
          date: "2026-01-16",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "Fr", untilDate: "2026-04-17", excludedDates: [] },
      });
      const term = makeReplacementTerm();

      const result = applyImportantDateTransforms([friday], term);

      const copy = result.find(
        (event) =>
          event.time.kind === "timed" && event.time.date === "2026-04-06" && !event.recurrence,
      );
      expect(copy).toMatchObject({
        summary: "PHY 1101",
        description: "Course: Physics I",
        location: "STE 0128",
        time: {
          kind: "timed",
          date: "2026-04-06",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
      });
      expect(copy?.uid).toContain(term.sourceId);
      expect(copy?.uid).toContain("good-friday-swap");
      expect(copy?.uid).toContain("PHY1101-LEC-Fr-780-840");

      const updatedFriday = result.find((event) => event.uid === "PHY1101-LEC-Fr-780-840@uoplan");
      expect(updatedFriday).toMatchObject({ recurrence: { excludedDates: ["2026-04-03"] } });
    });

    it("excludes the regular replacement-day event on the replacement date", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const term = makeReplacementTerm();

      const result = applyImportantDateTransforms([monday], term);
      const updatedMonday = result.find((event) => event.uid === monday.uid);

      expect(updatedMonday).toMatchObject({ recurrence: { excludedDates: ["2026-04-06"] } });
    });

    it("does not copy when the source date falls outside the recurrence bounds (ends too early)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const friday = weeklyEvent({
        uid: "PHY1101-LEC-Fr-780-840@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-16",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "Fr", untilDate: "2026-03-27", excludedDates: [] },
      });
      const term = makeReplacementTerm();

      const result = applyImportantDateTransforms([friday], term);
      expect(
        result.some((event) => event.time.kind === "timed" && event.time.date === "2026-04-06"),
      ).toBe(false);
    });

    it("does not copy when the source date falls outside the recurrence bounds (starts too late)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const friday = weeklyEvent({
        uid: "PHY1101-LEC-Fr-780-840@uoplan",
        time: {
          kind: "timed",
          date: "2026-04-10", // first occurrence is after the cancelled date 2026-04-03
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "Fr", untilDate: "2026-06-05", excludedDates: [] },
      });
      const term = makeReplacementTerm();

      const result = applyImportantDateTransforms([friday], term);
      expect(
        result.some((event) => event.time.kind === "timed" && event.time.date === "2026-04-06"),
      ).toBe(false);
    });

    it("does not copy when the source date was already excluded before this transform", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const friday = weeklyEvent({
        uid: "PHY1101-LEC-Fr-780-840@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-16",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: {
          frequency: "weekly",
          day: "Fr",
          untilDate: "2026-04-17",
          excludedDates: ["2026-04-03"],
        },
      });
      const term = makeReplacementTerm();

      const result = applyImportantDateTransforms([friday], term);
      expect(
        result.some((event) => event.time.kind === "timed" && event.time.date === "2026-04-06"),
      ).toBe(false);
      expect(result.find((event) => event.uid === friday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-04-03"] },
      });
    });

    it("throws a typed ImportantDatesExportError for an invalid replacement rule", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const ImportantDatesExportError = getImportantDatesExportError();

      const badDate = makeReplacementTerm();
      badDate.sections[0].groups[0].items[0].replacement = replacementRule({
        cancelledDate: "2026-02-30",
      });
      expect(() => applyImportantDateTransforms([weeklyEvent()], badDate)).toThrow(
        ImportantDatesExportError,
      );

      const mismatchedWeekday = makeReplacementTerm();
      mismatchedWeekday.sections[0].groups[0].items[0].replacement = replacementRule({
        sourceDay: "Mo",
      });
      expect(() => applyImportantDateTransforms([weeklyEvent()], mismatchedWeekday)).toThrow(
        ImportantDatesExportError,
      );
      expect(() => applyImportantDateTransforms([weeklyEvent()], mismatchedWeekday)).toThrow(
        /weekday|day/i,
      );
    });

    it("skips a schedule_replacement row without replacement data (undated)", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const term = makeTerm([
        makeItem("schedule_replacement", { id: "tbd", topic: "TBD", dateText: "" }),
      ]);

      const result = applyImportantDateTransforms([monday], term);
      expect(result).toEqual([monday]);
    });

    it("deduplicates copies and keeps deterministic ordering when the same rule/source pairing repeats", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const friday = weeklyEvent({
        uid: "PHY1101-LEC-Fr-780-840@uoplan",
        time: {
          kind: "timed",
          date: "2026-01-16",
          startMinutes: 780,
          endMinutes: 840,
          timeZone: "America/Toronto",
        },
        recurrence: { frequency: "weekly", day: "Fr", untilDate: "2026-04-17", excludedDates: [] },
      });
      const duplicateItem = () =>
        makeItem("schedule_replacement", {
          id: "swap-1",
          topic: "Swap",
          dateText: "April 6",
          replacement: replacementRule(),
        });
      const term = makeTerm([duplicateItem()], {
        sections: [
          {
            id: "s1",
            label: "Schedule changes",
            category: "schedule_changes",
            groups: [
              { id: "g1", items: [duplicateItem()] },
              { id: "g2", items: [duplicateItem()] },
            ],
          },
        ],
      });

      const result = applyImportantDateTransforms([friday], term);
      const copies = result.filter(
        (event) => event.time.kind === "timed" && event.time.date === "2026-04-06",
      );
      expect(copies).toHaveLength(1);

      const rerun = applyImportantDateTransforms([friday], term);
      expect(rerun.map((event) => event.uid)).toEqual(result.map((event) => event.uid));
    });
  });

  describe("deadline enrichment", () => {
    it("does not add deadline events by default", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeTerm([
        makeItem("deadline", {
          id: "add-drop",
          topic: "Add/drop deadline",
          dateText: "Jan 23",
          interval: interval("2026-01-23", "2026-01-23"),
        }),
      ]);

      const result = applyImportantDateTransforms([], term);
      expect(result).toEqual([]);
    });

    it("adds each dated deadline exactly once as an all-day event when includeDeadlines is true", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeTerm([
        makeItem("deadline", {
          id: "add-drop",
          topic: "Add/drop deadline",
          dateText: "Jan 23, 5 p.m.",
          interval: interval("2026-01-23", "2026-01-23", { startMinutes: 1020 }),
        }),
      ]);

      const result = applyImportantDateTransforms([], term, { includeDeadlines: true });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        summary: "Add/drop deadline",
        time: { kind: "all-day", startDate: "2026-01-23", endDate: "2026-01-23" },
      });
      expect(result[0]?.uid).toContain(term.sourceId);
      expect(result[0]?.uid).toContain("add-drop");
      expect(result[0]?.description).toContain("Jan 23, 5 p.m.");
    });

    it("keeps no_classes and schedule_replacement effects unchanged regardless of includeDeadlines", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const term = makeTerm([
        makeItem("no_classes", {
          id: "family-day",
          topic: "Family Day",
          dateText: "Feb 16",
          interval: interval("2026-02-16", "2026-02-16"),
        }),
      ]);

      const withoutFlag = applyImportantDateTransforms([monday], term);
      const withFlag = applyImportantDateTransforms([monday], term, { includeDeadlines: true });

      expect(withoutFlag.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-16"] },
      });
      expect(withFlag.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-16"] },
      });
    });
  });

  describe("structural, informational, and undated rows", () => {
    it("never alter recurrence or get added to schedule exports, regardless of includeDeadlines", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();
      const term = makeTerm([
        makeItem("structural", {
          id: "term-dates",
          topic: "Term dates",
          dateText: "Jan 1 to Apr 30",
          interval: interval("2026-01-01", "2026-04-30"),
        }),
        makeItem("informational", {
          id: "info-1",
          topic: "Some info",
          dateText: "Feb 1",
          interval: interval("2026-02-01", "2026-02-01"),
        }),
        makeItem("deadline", { id: "undated-deadline", topic: "TBD deadline", dateText: "" }),
        makeItem("no_classes", { id: "undated-break", topic: "TBD break", dateText: "" }),
        makeItem("schedule_replacement", { id: "undated-swap", topic: "TBD swap", dateText: "" }),
      ]);

      const withoutDeadlines = applyImportantDateTransforms([monday], term);
      const withDeadlines = applyImportantDateTransforms([monday], term, {
        includeDeadlines: true,
      });

      expect(withoutDeadlines).toEqual([monday]);
      expect(withDeadlines).toEqual([monday]);
    });
  });

  describe("term isolation", () => {
    it("only applies the provided term's rules and never another term's", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent();

      const termA = makeTerm(
        [
          makeItem("no_classes", {
            id: "a-break",
            topic: "Term A break",
            dateText: "Feb 16",
            interval: interval("2026-02-16", "2026-02-16"),
          }),
        ],
        { sourceId: "term-a" },
      );
      const termB = makeTerm(
        [
          makeItem("no_classes", {
            id: "b-break",
            topic: "Term B break",
            dateText: "Mar 2",
            interval: interval("2026-03-02", "2026-03-02"),
          }),
        ],
        { sourceId: "term-b" },
      );

      const resultA = applyImportantDateTransforms([monday], termA);
      const resultB = applyImportantDateTransforms([monday], termB);

      expect(resultA.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-02-16"] },
      });
      expect(resultB.find((event) => event.uid === monday.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-03-02"] },
      });
      expect(resultA.some((event) => event.uid.includes("term-b"))).toBe(false);
      expect(resultB.some((event) => event.uid.includes("term-a"))).toBe(false);
    });
  });

  describe("immutability", () => {
    it("does not mutate input events or the term", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const monday = weeklyEvent({
        recurrence: {
          frequency: "weekly",
          day: "Mo",
          untilDate: "2026-04-13",
          excludedDates: ["2026-01-19"],
        },
      });
      const term = makeTerm([
        makeItem("no_classes", {
          id: "family-day",
          topic: "Family Day",
          dateText: "Feb 16",
          interval: interval("2026-02-16", "2026-02-16"),
        }),
        makeItem("schedule_replacement", {
          id: "swap",
          topic: "Swap",
          dateText: "Apr 6",
          replacement: replacementRule(),
        }),
      ]);

      const eventsSnapshot = clone([monday]);
      const termSnapshot = clone(term);

      const frozenEvents = deepFreeze([monday]);
      const frozenTerm = deepFreeze(term);

      expect(() =>
        applyImportantDateTransforms(frozenEvents, frozenTerm, { includeDeadlines: true }),
      ).not.toThrow();

      expect(monday).toEqual(eventsSnapshot[0]);
      expect(term).toEqual(termSnapshot);
    });
  });
});

describe("importantDateTermToCalendarEvents", () => {
  it("includes no_classes, deadline, and informational dated rows as all-day events, and a schedule_replacement notice on the replacement date", () => {
    const importantDateTermToCalendarEvents = getImportantDateTermToCalendarEvents();
    const term = makeTerm([
      makeItem("no_classes", {
        id: "family-day",
        topic: "Family Day",
        dateText: "Feb 16",
        interval: interval("2026-02-16", "2026-02-16"),
      }),
      makeItem("deadline", {
        id: "add-drop",
        topic: "Add/drop deadline",
        dateText: "Jan 23",
        interval: interval("2026-01-23", "2026-01-23"),
      }),
      makeItem("informational", {
        id: "info-1",
        topic: "Reading list posted",
        dateText: "Jan 5",
        interval: interval("2026-01-05", "2026-01-05"),
      }),
      makeItem("schedule_replacement", {
        id: "swap",
        topic: "Friday schedule follows on Monday",
        dateText: "April 6",
        replacement: replacementRule(),
      }),
      makeItem("structural", {
        id: "term-dates",
        topic: "Term dates",
        dateText: "Jan 1 to Apr 30",
        interval: interval("2026-01-01", "2026-04-30"),
      }),
      makeItem("no_classes", { id: "tbd-break", topic: "TBD break", dateText: "" }),
    ]);

    const events = importantDateTermToCalendarEvents(term);

    expect(events).toHaveLength(4);
    expect(events.every((event) => event.time.kind === "all-day")).toBe(true);
    expect(events.find((event) => event.uid.includes("family-day"))).toMatchObject({
      summary: "Family Day",
      time: { startDate: "2026-02-16", endDate: "2026-02-16" },
    });
    expect(events.find((event) => event.uid.includes("add-drop"))).toMatchObject({
      summary: "Add/drop deadline",
    });
    expect(events.find((event) => event.uid.includes("info-1"))).toMatchObject({
      summary: "Reading list posted",
    });
    expect(events.find((event) => event.uid.includes("swap"))).toMatchObject({
      summary: "Friday schedule follows on Monday",
      time: { startDate: "2026-04-06", endDate: "2026-04-06" },
    });
    expect(events.some((event) => event.uid.includes("term-dates"))).toBe(false);
    expect(events.some((event) => event.uid.includes("tbd-break"))).toBe(false);
  });

  it("is deterministic and sorted by uid", () => {
    const importantDateTermToCalendarEvents = getImportantDateTermToCalendarEvents();
    const term = makeTerm([
      makeItem("no_classes", {
        id: "family-day",
        topic: "Family Day",
        dateText: "Feb 16",
        interval: interval("2026-02-16", "2026-02-16"),
      }),
      makeItem("deadline", {
        id: "add-drop",
        topic: "Add/drop deadline",
        dateText: "Jan 23",
        interval: interval("2026-01-23", "2026-01-23"),
      }),
    ]);

    const first = importantDateTermToCalendarEvents(term);
    const second = importantDateTermToCalendarEvents(term);

    expect(first.map((event) => event.uid)).toEqual(second.map((event) => event.uid));
    expect(first.map((event) => event.uid)).toEqual(
      first.map((event) => event.uid).sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe("applyImportantDateTransforms — session scoping", () => {
  const sessionA = makeSession("A", interval("2026-05-04", "2026-06-12"));
  const sessionB = makeSession("B", interval("2026-06-15", "2026-07-24"));

  function eventA(): TimedCalendarEvent {
    return weeklyEvent({
      uid: "COURSE-A@uoplan",
      summary: "COURSE A",
      time: {
        kind: "timed",
        date: "2026-05-04",
        startMinutes: 540,
        endMinutes: 600,
        timeZone: "America/Toronto",
      },
      recurrence: {
        frequency: "weekly",
        day: "Mo",
        untilDate: "2026-06-12",
        excludedDates: [],
        activeRange: { startDate: "2026-05-04", endDate: "2026-06-12" },
      },
    });
  }

  function eventB(): TimedCalendarEvent {
    return weeklyEvent({
      uid: "COURSE-B@uoplan",
      summary: "COURSE B",
      time: {
        kind: "timed",
        date: "2026-06-15",
        startMinutes: 540,
        endMinutes: 600,
        timeZone: "America/Toronto",
      },
      recurrence: {
        frequency: "weekly",
        day: "Mo",
        untilDate: "2026-07-24",
        excludedDates: [],
        activeRange: { startDate: "2026-06-15", endDate: "2026-07-24" },
      },
    });
  }

  /** Spans the whole spring-summer term — ties A and B on overlap, so it is never uniquely matched. */
  function eventAmbiguous(): TimedCalendarEvent {
    return weeklyEvent({
      uid: "COURSE-FULL@uoplan",
      summary: "COURSE FULL",
      time: {
        kind: "timed",
        date: "2026-05-04",
        startMinutes: 540,
        endMinutes: 600,
        timeZone: "America/Toronto",
      },
      recurrence: {
        frequency: "weekly",
        day: "Mo",
        untilDate: "2026-07-24",
        excludedDates: [],
        activeRange: { startDate: "2026-05-04", endDate: "2026-07-24" },
      },
    });
  }

  describe("no_classes", () => {
    it("adds the scoped closure and excludes only the matching-session event when at least one event matches", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup(
            [
              makeItem("no_classes", {
                id: "a-only-break",
                topic: "Session A reading day",
                dateText: "May 25",
                interval: interval("2026-05-25", "2026-05-25"),
              }),
            ],
            { sessionCode: "A" },
          ),
        ],
      });

      const result = applyImportantDateTransforms([eventA(), eventB(), eventAmbiguous()], term);

      expect(result.find((event) => event.uid.includes("a-only-break"))).toMatchObject({
        summary: "Session A reading day",
        time: { kind: "all-day", startDate: "2026-05-25", endDate: "2026-05-25" },
      });
      expect(result.find((event) => event.uid === "COURSE-A@uoplan")).toMatchObject({
        recurrence: { excludedDates: ["2026-05-25"] },
      });
      expect(result.find((event) => event.uid === "COURSE-B@uoplan")).toMatchObject({
        recurrence: { excludedDates: [] },
      });
      expect(result.find((event) => event.uid === "COURSE-FULL@uoplan")).toMatchObject({
        recurrence: { excludedDates: [] },
      });
    });

    it("adds no closure and no exclusions when no source event matches the scoped session", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup(
            [
              makeItem("no_classes", {
                id: "a-only-break",
                topic: "Session A reading day",
                dateText: "May 25",
                interval: interval("2026-05-25", "2026-05-25"),
              }),
            ],
            { sessionCode: "A" },
          ),
        ],
      });

      // Only the Session B event is present — nothing matches "A".
      const result = applyImportantDateTransforms([eventB()], term);

      expect(result.some((event) => event.uid.includes("a-only-break"))).toBe(false);
      expect(result).toEqual([eventB()]);
    });

    it("preserves unscoped (global) behavior exactly, including when zero events are supplied", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup([
            makeItem("no_classes", {
              id: "global-break",
              topic: "University closed",
              dateText: "n/a",
              interval: interval("2026-05-25", "2026-05-25"),
            }),
          ]),
        ],
      });

      const result = applyImportantDateTransforms([], term);
      expect(result.find((event) => event.uid.includes("global-break"))).toMatchObject({
        summary: "University closed",
      });
    });
  });

  describe("schedule_replacement", () => {
    it("copies/excludes only the matching-session event when at least one event matches", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup(
            [
              makeItem("schedule_replacement", {
                id: "a-only-swap",
                topic: "Session A Monday follows Tuesday schedule",
                dateText: "May 25",
                replacement: {
                  cancelledDate: "2026-05-25", // Monday, within session A
                  replacementDate: "2026-05-26",
                  sourceDay: "Mo",
                },
              }),
            ],
            { sessionCode: "A" },
          ),
        ],
      });

      const result = applyImportantDateTransforms([eventA(), eventB(), eventAmbiguous()], term);

      expect(result.find((event) => event.uid === "COURSE-A@uoplan")).toMatchObject({
        recurrence: { excludedDates: ["2026-05-25"] },
      });
      expect(result.find((event) => event.uid === "COURSE-B@uoplan")).toMatchObject({
        recurrence: { excludedDates: [] },
      });
      expect(result.find((event) => event.uid === "COURSE-FULL@uoplan")).toMatchObject({
        recurrence: { excludedDates: [] },
      });
      const copy = result.find(
        (event) => event.time.kind === "timed" && event.time.date === "2026-05-26",
      );
      expect(copy).toBeDefined();
      expect(copy?.uid).toContain("COURSE-A");
    });

    it("produces no scoped result (no exclusions, no copies) when no source event matches the scoped session", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup(
            [
              makeItem("schedule_replacement", {
                id: "a-only-swap",
                topic: "Session A swap",
                dateText: "May 25",
                replacement: {
                  cancelledDate: "2026-05-25",
                  replacementDate: "2026-05-26",
                  sourceDay: "Mo",
                },
              }),
            ],
            { sessionCode: "A" },
          ),
        ],
      });

      const result = applyImportantDateTransforms([eventB()], term);

      expect(
        result.some((event) => event.time.kind === "timed" && event.time.date === "2026-05-26"),
      ).toBe(false);
      expect(result).toEqual([eventB()]);
    });
  });

  describe("deadline enrichment", () => {
    it("adds the scoped deadline only when at least one event matches the scoped session", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup(
            [
              makeItem("deadline", {
                id: "b-only-deadline",
                topic: "Session B add/drop deadline",
                dateText: "July 10",
                interval: interval("2026-07-10", "2026-07-10"),
              }),
            ],
            { sessionCode: "B" },
          ),
        ],
      });

      const withB = applyImportantDateTransforms([eventA(), eventB(), eventAmbiguous()], term, {
        includeDeadlines: true,
      });
      expect(withB.find((event) => event.uid.includes("b-only-deadline"))).toMatchObject({
        summary: "Session B add/drop deadline",
      });

      // Session B is not represented — even though the ambiguous event's real
      // time window covers the deadline date, it must not stand in for "B".
      const withoutB = applyImportantDateTransforms([eventA(), eventAmbiguous()], term, {
        includeDeadlines: true,
      });
      expect(withoutB.some((event) => event.uid.includes("b-only-deadline"))).toBe(false);
    });

    it("adds a global (unscoped) deadline regardless of any session match", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup([
            makeItem("deadline", {
              id: "global-deadline",
              topic: "Term-wide deadline",
              dateText: "n/a",
              interval: interval("2026-07-10", "2026-07-10"),
            }),
          ]),
        ],
      });

      const result = applyImportantDateTransforms([], term, { includeDeadlines: true });
      expect(result.find((event) => event.uid.includes("global-deadline"))).toMatchObject({
        summary: "Term-wide deadline",
      });
    });
  });

  describe("ambiguous meeting ranges", () => {
    it("receive global transformations but never session-scoped transformations or deadlines", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          makeGroup([
            makeItem("no_classes", {
              id: "global-break",
              topic: "Global closure",
              dateText: "n/a",
              interval: interval("2026-06-08", "2026-06-08"),
            }),
          ]),
          makeGroup(
            [
              makeItem("no_classes", {
                id: "a-only-break",
                topic: "Session A only closure",
                dateText: "n/a",
                interval: interval("2026-06-08", "2026-06-08"),
              }),
            ],
            { id: "group-a", sessionCode: "A" },
          ),
          makeGroup(
            [
              makeItem("deadline", {
                id: "b-only-deadline",
                topic: "Session B only deadline",
                dateText: "n/a",
                interval: interval("2026-06-08", "2026-06-08"),
              }),
            ],
            { id: "group-b", sessionCode: "B" },
          ),
        ],
      });

      const ambiguous = eventAmbiguous();
      const result = applyImportantDateTransforms([ambiguous], term, { includeDeadlines: true });

      // Global item: the ambiguous event is still excluded on the shared date.
      expect(result.find((event) => event.uid === ambiguous.uid)).toMatchObject({
        recurrence: { excludedDates: ["2026-06-08"] },
      });
      // Global closure marker is present.
      expect(result.some((event) => event.uid.includes("global-break"))).toBe(true);
      // Scoped items never fire for an event that matched no session.
      expect(result.some((event) => event.uid.includes("a-only-break"))).toBe(false);
      expect(result.some((event) => event.uid.includes("b-only-deadline"))).toBe(false);
    });
  });

  describe("mixed schedule (Session A + Session B + ambiguous)", () => {
    function mixedTerm(): ImportantDateTerm {
      return makeSessionTerm({
        sessions: [sessionA, sessionB],
        groups: [
          // Global closure: spans the session A/B boundary week, hitting each
          // event's own Monday occurrence wherever it is actually active.
          makeGroup([
            makeItem("no_classes", {
              id: "global-break",
              topic: "University closed",
              dateText: "n/a",
              interval: interval("2026-06-08", "2026-06-19"),
            }),
            makeItem("schedule_replacement", {
              id: "global-swap",
              topic: "Global Monday follows Tuesday schedule",
              dateText: "May 18",
              replacement: {
                cancelledDate: "2026-05-18", // Monday, within A/FULL's window but before B starts
                replacementDate: "2026-05-19",
                sourceDay: "Mo",
              },
            }),
          ]),
          // Session-A-scoped closure.
          makeGroup(
            [
              makeItem("no_classes", {
                id: "a-only-break",
                topic: "Session A only closure",
                dateText: "May 25",
                interval: interval("2026-05-25", "2026-05-25"),
              }),
            ],
            { id: "group-a", sessionCode: "A" },
          ),
          // Session-B-scoped deadline.
          makeGroup(
            [
              makeItem("deadline", {
                id: "b-only-deadline",
                topic: "Session B add/drop deadline",
                dateText: "July 10",
                interval: interval("2026-07-10", "2026-07-10"),
              }),
            ],
            { id: "group-b", sessionCode: "B" },
          ),
        ],
      });
    }

    it("applies the global closure to every eligible event's own occurrence", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const result = applyImportantDateTransforms(
        [eventA(), eventB(), eventAmbiguous()],
        mixedTerm(),
        { includeDeadlines: true },
      );

      expect(result.find((event) => event.uid === "COURSE-A@uoplan")).toMatchObject({
        recurrence: { excludedDates: ["2026-05-18", "2026-05-25", "2026-06-08"] },
      });
      expect(result.find((event) => event.uid === "COURSE-B@uoplan")).toMatchObject({
        recurrence: { excludedDates: ["2026-06-15"] },
      });
      expect(result.find((event) => event.uid === "COURSE-FULL@uoplan")).toMatchObject({
        recurrence: { excludedDates: ["2026-05-18", "2026-06-08", "2026-06-15"] },
      });
    });

    it("applies the global schedule_replacement to every eligible event regardless of session match", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const result = applyImportantDateTransforms(
        [eventA(), eventB(), eventAmbiguous()],
        mixedTerm(),
        { includeDeadlines: true },
      );

      // Session A (matched "A") and the ambiguous event (matched no session)
      // are both eligible on 2026-05-18 — the global item processes both,
      // proving it is never gated by session scope.
      const copyDates = result
        .filter((event) => event.time.kind === "timed" && event.time.date === "2026-05-19")
        .map((event) => event.uid);
      expect(copyDates.some((uid) => uid.includes("COURSE-A"))).toBe(true);
      expect(copyDates.some((uid) => uid.includes("COURSE-FULL"))).toBe(true);
      // Session B never reaches 2026-05-18 (its window starts 2026-06-15), so
      // it naturally has no copy — orthogonal to scoping, purely time bounds.
      expect(copyDates.some((uid) => uid.includes("COURSE-B"))).toBe(false);
    });

    it("keeps Session-A-scoped recurrence changes from ever touching Session B", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const result = applyImportantDateTransforms(
        [eventA(), eventB(), eventAmbiguous()],
        mixedTerm(),
        { includeDeadlines: true },
      );

      const bExclusions =
        result.find((event) => event.uid === "COURSE-B@uoplan")?.recurrence?.excludedDates ?? [];
      expect(bExclusions).not.toContain("2026-05-25");
    });

    it("includes the Session-B-scoped deadline only when Session B is represented in the source events", () => {
      const applyImportantDateTransforms = getApplyImportantDateTransforms();
      const term = mixedTerm();

      const withB = applyImportantDateTransforms([eventA(), eventB(), eventAmbiguous()], term, {
        includeDeadlines: true,
      });
      expect(withB.some((event) => event.uid.includes("b-only-deadline"))).toBe(true);

      const withoutB = applyImportantDateTransforms([eventA(), eventAmbiguous()], term, {
        includeDeadlines: true,
      });
      expect(withoutB.some((event) => event.uid.includes("b-only-deadline"))).toBe(false);
    });
  });
});
