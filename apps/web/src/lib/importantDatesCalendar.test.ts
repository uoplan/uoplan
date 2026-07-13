import { describe, expect, it } from "vitest";
import type { ImportantDateTerm } from "@uoplan/core/dataTypes";
import {
  buildCalendarMonth,
  flattenTermToCalendarEntries,
  formatMonthLabel,
  formatWeekdayLabels,
  monthOfIsoDate,
  resolveInitialMonth,
  shiftMonth,
} from "./importantDatesCalendar";

// ── Fixtures ─────────────────────────────────────────────────────────────

function interval(start: string, end: string) {
  return { startDate: start, endDate: end };
}

function makeTerm(overrides: Partial<ImportantDateTerm> = {}): ImportantDateTerm {
  return {
    sourceId: "winter-2026",
    label: "Winter 2026",
    season: "winter",
    year: 2026,
    sourcePublished: "true",
    termInterval: interval("2026-01-01", "2026-04-30"),
    courseInterval: interval("2026-01-12", "2026-04-10"),
    sessions: [],
    sections: [],
    ...overrides,
  };
}

// ── flattenTermToCalendarEntries ─────────────────────────────────────────

describe("flattenTermToCalendarEntries", () => {
  it("omits structural rows", () => {
    const term = makeTerm({
      sections: [
        {
          id: "overview",
          label: "Overview",
          category: "overview",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "term-range",
                  topic: "Term dates",
                  dateText: "Jan 12 to Apr 10",
                  effect: "structural",
                  interval: interval("2026-01-12", "2026-04-10"),
                },
              ],
            },
          ],
        },
      ],
    });
    expect(flattenTermToCalendarEntries(term)).toEqual([]);
  });

  it("omits undated rows (no interval and no replacement)", () => {
    const term = makeTerm({
      sections: [
        {
          id: "info",
          label: "Info",
          category: "other",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "no-date",
                  topic: "General note",
                  dateText: "See website",
                  effect: "informational",
                },
              ],
            },
          ],
        },
      ],
    });
    expect(flattenTermToCalendarEntries(term)).toEqual([]);
  });

  it("maps effects to semantic variants and retains item identity", () => {
    const term = makeTerm({
      sections: [
        {
          id: "breaks",
          label: "Breaks",
          category: "breaks",
          groups: [
            {
              id: "grp-1",
              label: "Reading week",
              items: [
                {
                  id: "reading-week",
                  topic: "Reading week",
                  dateText: "Feb 16 to Feb 20, 2026",
                  effect: "no_classes",
                  interval: interval("2026-02-16", "2026-02-20"),
                },
              ],
            },
          ],
        },
      ],
    });
    const [entry] = flattenTermToCalendarEntries(term);
    expect(entry).toMatchObject({
      itemId: "reading-week",
      sectionId: "breaks",
      groupId: "grp-1",
      topic: "Reading week",
      dateText: "Feb 16 to Feb 20, 2026",
      startDate: "2026-02-16",
      endDate: "2026-02-20",
      variant: "break",
    });
    expect(entry.sourceOrder).toBe(0);
  });

  it("maps deadline and informational effects", () => {
    const term = makeTerm({
      sections: [
        {
          id: "enrolment",
          label: "Enrolment",
          category: "enrolment",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "deadline-1",
                  topic: "Add/drop deadline",
                  dateText: "Jan 20, 2026",
                  effect: "deadline",
                  interval: interval("2026-01-20", "2026-01-20"),
                },
                {
                  id: "info-1",
                  topic: "Tip",
                  dateText: "Jan 21, 2026",
                  effect: "informational",
                  interval: interval("2026-01-21", "2026-01-21"),
                },
              ],
            },
          ],
        },
      ],
    });
    const entries = flattenTermToCalendarEntries(term);
    expect(entries.map((e) => e.variant)).toEqual(["deadline", "information"]);
  });

  it("uses the schedule replacement's replacementDate over its interval", () => {
    const term = makeTerm({
      sections: [
        {
          id: "schedule_changes",
          label: "Schedule changes",
          category: "schedule_changes",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "monday-swap",
                  topic: "Monday schedule follows",
                  dateText: "Mon Oct 13 follows a Friday schedule",
                  effect: "schedule_replacement",
                  interval: interval("2026-10-13", "2026-10-13"),
                  replacement: {
                    cancelledDate: "2026-10-13",
                    replacementDate: "2026-10-16",
                    sourceDay: "Fr",
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const [entry] = flattenTermToCalendarEntries(term);
    expect(entry.startDate).toBe("2026-10-16");
    expect(entry.endDate).toBe("2026-10-16");
    expect(entry.variant).toBe("schedule-change");
  });

  it("falls back to the interval when a schedule_replacement item has no replacement", () => {
    const term = makeTerm({
      sections: [
        {
          id: "schedule_changes",
          label: "Schedule changes",
          category: "schedule_changes",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "swap-2",
                  topic: "Schedule note",
                  dateText: "Oct 13, 2026",
                  effect: "schedule_replacement",
                  interval: interval("2026-10-13", "2026-10-13"),
                },
              ],
            },
          ],
        },
      ],
    });
    const [entry] = flattenTermToCalendarEntries(term);
    expect(entry.startDate).toBe("2026-10-13");
    expect(entry.endDate).toBe("2026-10-13");
  });

  it("assigns increasing sourceOrder across sections/groups/items in document order", () => {
    const term = makeTerm({
      sections: [
        {
          id: "s1",
          label: "S1",
          category: "breaks",
          groups: [
            {
              id: "g1",
              items: [
                {
                  id: "a",
                  topic: "A",
                  dateText: "d",
                  effect: "no_classes",
                  interval: interval("2026-01-05", "2026-01-05"),
                },
                {
                  id: "b",
                  topic: "B",
                  dateText: "d",
                  effect: "no_classes",
                  interval: interval("2026-01-06", "2026-01-06"),
                },
              ],
            },
          ],
        },
        {
          id: "s2",
          label: "S2",
          category: "enrolment",
          groups: [
            {
              id: "g2",
              items: [
                {
                  id: "c",
                  topic: "C",
                  dateText: "d",
                  effect: "deadline",
                  interval: interval("2026-01-07", "2026-01-07"),
                },
              ],
            },
          ],
        },
      ],
    });
    const entries = flattenTermToCalendarEntries(term);
    expect(entries.map((e) => e.itemId)).toEqual(["a", "b", "c"]);
    expect(entries.map((e) => e.sourceOrder)).toEqual([0, 1, 2]);
  });
});

// ── resolveInitialMonth ───────────────────────────────────────────────────

describe("resolveInitialMonth", () => {
  it("uses today's month when today is inside termInterval", () => {
    const term = makeTerm({ termInterval: interval("2026-01-01", "2026-04-30") });
    expect(resolveInitialMonth(term, "2026-03-15")).toEqual({ year: 2026, month: 3 });
  });

  it("falls back to courseInterval.startDate month when today is outside termInterval", () => {
    const term = makeTerm({
      termInterval: interval("2026-01-01", "2026-04-30"),
      courseInterval: interval("2026-01-12", "2026-04-10"),
    });
    expect(resolveInitialMonth(term, "2025-12-01")).toEqual({ year: 2026, month: 1 });
  });
});

// ── monthOfIsoDate ──────────────────────────────────────────────────────────

describe("monthOfIsoDate", () => {
  it("extracts the resolved {year, month} from an ISO date string", () => {
    expect(monthOfIsoDate("2025-11-15")).toEqual({ year: 2025, month: 11 });
  });

  it("handles December correctly (no accidental month rollover)", () => {
    expect(monthOfIsoDate("2026-12-31")).toEqual({ year: 2026, month: 12 });
  });
});

// ── shiftMonth ────────────────────────────────────────────────────────────

describe("shiftMonth", () => {
  it("moves forward across a year boundary", () => {
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
  });

  it("moves backward across a year boundary", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("moves forward within a year", () => {
    expect(shiftMonth({ year: 2026, month: 3 }, 1)).toEqual({ year: 2026, month: 4 });
  });
});

// ── formatMonthLabel / formatWeekdayLabels ───────────────────────────────

describe("formatMonthLabel", () => {
  it("formats a localized, capitalized month + year using Intl", () => {
    expect(formatMonthLabel({ year: 2026, month: 3 }, "en")).toBe("March 2026");
  });

  it("supports another locale", () => {
    expect(formatMonthLabel({ year: 2026, month: 3 }, "fr-CA")).toMatch(/mars/i);
  });
});

describe("formatWeekdayLabels", () => {
  it("returns 7 Monday-first labels", () => {
    const labels = formatWeekdayLabels("en");
    expect(labels).toHaveLength(7);
  });

  it("starts on Monday", () => {
    const labels = formatWeekdayLabels("en", "long");
    expect(labels[0]).toBe("Monday");
    expect(labels[6]).toBe("Sunday");
  });
});

// ── buildCalendarMonth ────────────────────────────────────────────────────

function entry(
  itemId: string,
  startDate: string,
  endDate: string,
  overrides: Partial<Parameters<typeof flattenTermToCalendarEntries>[0]> = {},
) {
  return {
    itemId,
    sectionId: "s",
    groupId: "g",
    sourceOrder: 0,
    topic: itemId,
    dateText: `${startDate}-${endDate}`,
    startDate,
    endDate,
    variant: "deadline" as const,
    ...overrides,
  };
}

describe("buildCalendarMonth", () => {
  it("builds a Monday-first 6-week (42 day) grid for the month", () => {
    const month = buildCalendarMonth([], { year: 2026, month: 3 });
    expect(month.weeks).toHaveLength(6);
    for (const week of month.weeks) {
      expect(week.days).toHaveLength(7);
    }
    // March 2026 starts on a Sunday; the grid's first day must be the Monday
    // of the prior week (2026-02-23), and every week must start on a Monday.
    expect(month.weeks[0]!.days[0]!.date).toBe("2026-02-23");
    for (const week of month.weeks) {
      const firstDate = new Date(`${week.days[0]!.date}T00:00:00Z`);
      expect(firstDate.getUTCDay()).toBe(1); // Monday
    }
  });

  it("flags days outside the target month as inCurrentMonth=false", () => {
    const month = buildCalendarMonth([], { year: 2026, month: 3 });
    expect(month.weeks[0]!.days[0]!.inCurrentMonth).toBe(false); // Feb 23
    const marchFirstDay = month.weeks[0]!.days.find((d) => d.date === "2026-03-01");
    expect(marchFirstDay?.inCurrentMonth).toBe(true);
  });

  it("places a single-day entry as a span-1 segment on its day, with range start/end true", () => {
    const entries = [entry("a", "2026-03-04", "2026-03-04")];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 });
    const week = month.weeks.find((w) => w.days.some((d) => d.date === "2026-03-04"))!;
    const laneCell = week.laneRows[0]!.find((c) => c.kind === "segment" && c.entry.itemId === "a");
    expect(laneCell).toMatchObject({
      kind: "segment",
      span: 1,
      isRangeStart: true,
      isRangeEnd: true,
    });
  });

  it("splits a multi-day range crossing a week boundary into two continuous segments", () => {
    // 2026-03-01 is a Sunday (end of the first grid week); the range crosses
    // into the following Monday.
    const entries = [entry("multi", "2026-02-27", "2026-03-02")];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 });
    const segments = month.weeks.flatMap((w) =>
      w.laneRows.flatMap((lane) =>
        lane.filter((c) => c.kind === "segment" && c.entry.itemId === "multi"),
      ),
    );
    expect(segments).toHaveLength(2);
    const [first, second] = segments as Array<
      Extract<(typeof segments)[number], { kind: "segment" }>
    >;
    expect(first.isRangeStart).toBe(true);
    expect(first.isRangeEnd).toBe(false);
    expect(second.isRangeStart).toBe(false);
    expect(second.isRangeEnd).toBe(true);
  });

  it("preserves lane index across week boundaries for a continuing entry when possible", () => {
    const entries = [
      entry("multi", "2026-02-27", "2026-03-02"),
      entry("other", "2026-02-23", "2026-02-24"),
    ];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 });
    const laneIndexOf = (itemId: string) =>
      month.weeks
        .map((w) =>
          w.laneRows.findIndex((lane) =>
            lane.some((c) => c.kind === "segment" && c.entry.itemId === itemId),
          ),
        )
        .filter((idx) => idx !== -1);
    const lanes = laneIndexOf("multi");
    expect(lanes.length).toBe(2); // appears in two weeks
    expect(lanes[0]).toBe(lanes[1]); // same lane in both weeks
  });

  it("assigns separate lanes to overlapping entries", () => {
    const entries = [
      entry("x", "2026-03-04", "2026-03-06"),
      entry("y", "2026-03-05", "2026-03-07"),
    ];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 });
    const laneOf = (itemId: string) =>
      month.weeks
        .flatMap((w) => w.laneRows.map((lane, idx) => ({ idx, lane })))
        .find(({ lane }) => lane.some((c) => c.kind === "segment" && c.entry.itemId === itemId))
        ?.idx;
    expect(laneOf("x")).not.toBe(laneOf("y"));
  });

  it("caps visible lanes and reports hiddenEntries per day beyond the cap", () => {
    const entries = [
      entry("a", "2026-03-10", "2026-03-10"),
      entry("b", "2026-03-10", "2026-03-10"),
      entry("c", "2026-03-10", "2026-03-10"),
      entry("d", "2026-03-10", "2026-03-10"),
    ];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 }, { maxVisibleLanes: 3 });
    const week = month.weeks.find((w) => w.days.some((d) => d.date === "2026-03-10"))!;
    expect(week.laneRows.length).toBeLessThanOrEqual(3);
    const day = week.days.find((d) => d.date === "2026-03-10")!;
    expect(day.hiddenEntries).toHaveLength(1);
    expect(day.hiddenEntries[0]!.itemId).toBe("d");
  });

  it("keeps rows empty (no wasted lanes) for a week with no entries", () => {
    const month = buildCalendarMonth([], { year: 2026, month: 3 });
    expect(month.weeks[0]!.laneRows).toHaveLength(0);
  });

  it("returns lane cells whose spans sum to 7 for every non-empty lane row", () => {
    const entries = [entry("multi", "2026-02-27", "2026-03-02")];
    const month = buildCalendarMonth(entries, { year: 2026, month: 3 });
    for (const week of month.weeks) {
      for (const lane of week.laneRows) {
        const total = lane.reduce((sum, c) => sum + c.span, 0);
        expect(total).toBe(7);
      }
    }
  });
});
