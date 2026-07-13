import { beforeAll, describe, expect, it } from "vitest";
import type { ImportantDatesData, ImportantDateTerm } from "@uoplan/core/dataTypes";
import {
  groupTermsByPublication,
  isTermPassed,
  selectDefaultTerm,
  sortImportantDateTerms,
  todayInToronto,
} from "./importantDates";
import { dynamicActivate } from "../i18n";

beforeAll(async () => {
  await dynamicActivate("en");
});

// Minimal interval helper
function interval(start: string, end: string) {
  return { startDate: start, endDate: end };
}

function makeTerm(
  overrides: Partial<ImportantDateTerm> & {
    sourceId: string;
    season: ImportantDateTerm["season"];
    year: number;
    sourcePublished?: string;
    termStart?: string;
    termEnd?: string;
    courseStart?: string;
    courseEnd?: string;
  },
): ImportantDateTerm {
  return {
    sourceId: overrides.sourceId,
    termId: overrides.termId,
    label: overrides.label ?? overrides.sourceId,
    season: overrides.season,
    year: overrides.year,
    sourcePublished: overrides.sourcePublished ?? "true",
    termInterval:
      overrides.termInterval ??
      interval(overrides.termStart ?? "2024-01-01", overrides.termEnd ?? "2024-04-30"),
    courseInterval:
      overrides.courseInterval ??
      interval(overrides.courseStart ?? "2024-01-08", overrides.courseEnd ?? "2024-04-10"),
    sessions: overrides.sessions ?? [],
    sections: overrides.sections ?? [],
  };
}

// ── sortImportantDateTerms ─────────────────────────────────────────────────

describe("sortImportantDateTerms", () => {
  it("sorts by year ascending", () => {
    const terms = [
      makeTerm({ sourceId: "fall-2025", season: "fall", year: 2025 }),
      makeTerm({ sourceId: "winter-2024", season: "winter", year: 2024 }),
    ];
    const result = sortImportantDateTerms(terms);
    expect(result.map((t) => t.year)).toEqual([2024, 2025]);
  });

  it("within a year orders winter < spring-summer < fall", () => {
    const terms = [
      makeTerm({ sourceId: "fall-2025", season: "fall", year: 2025 }),
      makeTerm({ sourceId: "spring-2025", season: "spring-summer", year: 2025 }),
      makeTerm({ sourceId: "winter-2025", season: "winter", year: 2025 }),
    ];
    const result = sortImportantDateTerms(terms);
    expect(result.map((t) => t.sourceId)).toEqual(["winter-2025", "spring-2025", "fall-2025"]);
  });

  it("does not mutate the input array", () => {
    const terms = [
      makeTerm({ sourceId: "fall-2025", season: "fall", year: 2025 }),
      makeTerm({ sourceId: "winter-2024", season: "winter", year: 2024 }),
    ];
    const before = terms.map((t) => t.sourceId);
    sortImportantDateTerms(terms);
    expect(terms.map((t) => t.sourceId)).toEqual(before);
  });

  it("handles empty array", () => {
    expect(sortImportantDateTerms([])).toEqual([]);
  });

  it("is stable on equal year+season entries", () => {
    const a = makeTerm({ sourceId: "a", season: "winter", year: 2025 });
    const b = makeTerm({ sourceId: "b", season: "winter", year: 2025 });
    const result = sortImportantDateTerms([a, b]);
    expect(result.map((t) => t.sourceId)).toEqual(["a", "b"]);
  });
});

// ── groupTermsByPublication ────────────────────────────────────────────────

describe("groupTermsByPublication", () => {
  it("puts a published, not-yet-passed term into current group", () => {
    const term = makeTerm({
      sourceId: "t1",
      season: "fall",
      year: 2025,
      sourcePublished: "true",
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    const { current, historical } = groupTermsByPublication([term], "2025-10-01");
    expect(current).toHaveLength(1);
    expect(historical).toHaveLength(0);
  });

  it("puts sourcePublished=false into historical group regardless of dates", () => {
    const term = makeTerm({
      sourceId: "t1",
      season: "fall",
      year: 2025,
      sourcePublished: "false",
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    const { current, historical } = groupTermsByPublication([term], "2025-10-01");
    expect(current).toHaveLength(0);
    expect(historical).toHaveLength(1);
  });

  it("moves a published but passed term into the historical group", () => {
    const term = makeTerm({
      sourceId: "t1",
      season: "fall",
      year: 2025,
      sourcePublished: "true",
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    // today is after termInterval.endDate: the term has passed
    const { current, historical } = groupTermsByPublication([term], "2026-01-15");
    expect(current).toHaveLength(0);
    expect(historical.map((t) => t.sourceId)).toEqual(["t1"]);
  });

  it("keeps a published term current on its termInterval end date (inclusive)", () => {
    const term = makeTerm({
      sourceId: "t1",
      season: "fall",
      year: 2025,
      sourcePublished: "true",
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    const { current, historical } = groupTermsByPublication([term], "2025-12-31");
    expect(current.map((t) => t.sourceId)).toEqual(["t1"]);
    expect(historical).toHaveLength(0);
  });

  it("handles empty array", () => {
    const { current, historical } = groupTermsByPublication([], "2025-10-01");
    expect(current).toHaveLength(0);
    expect(historical).toHaveLength(0);
  });

  it("separates a mixed set correctly: passed-published and unpublished both land in historical", () => {
    const terms = [
      makeTerm({
        sourceId: "a",
        season: "winter",
        year: 2025,
        sourcePublished: "true",
        termStart: "2025-01-01",
        termEnd: "2025-04-30",
      }),
      makeTerm({
        sourceId: "b",
        season: "fall",
        year: 2024,
        sourcePublished: "false",
        termStart: "2024-09-01",
        termEnd: "2024-12-31",
      }),
      makeTerm({
        sourceId: "c",
        season: "spring-summer",
        year: 2025,
        sourcePublished: "true",
        termStart: "2025-05-01",
        termEnd: "2025-08-31",
      }),
      makeTerm({
        sourceId: "d",
        season: "fall",
        year: 2024,
        sourcePublished: "true",
        termStart: "2024-09-01",
        termEnd: "2024-12-31",
      }),
    ];
    // today is inside term "a"'s interval; "c" is future (not passed); "b" is
    // unpublished (archived); "d" has already ended (passed).
    const { current, historical } = groupTermsByPublication(terms, "2025-02-15");
    expect(current.map((t) => t.sourceId)).toEqual(["a", "c"]);
    expect(historical.map((t) => t.sourceId)).toEqual(["b", "d"]);
  });
});

// ── isTermPassed ───────────────────────────────────────────────────────────

describe("isTermPassed", () => {
  it("returns false when today is before termInterval endDate", () => {
    const term = makeTerm({
      sourceId: "t",
      season: "fall",
      year: 2025,
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    expect(isTermPassed(term, "2025-09-15")).toBe(false);
  });

  it("returns false on the termInterval endDate (inclusive)", () => {
    const term = makeTerm({
      sourceId: "t",
      season: "fall",
      year: 2025,
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    expect(isTermPassed(term, "2025-12-31")).toBe(false);
  });

  it("returns true when today is after termInterval endDate", () => {
    const term = makeTerm({
      sourceId: "t",
      season: "fall",
      year: 2025,
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
    });
    expect(isTermPassed(term, "2026-01-01")).toBe(true);
  });

  it("uses termInterval.endDate, not courseInterval.endDate", () => {
    const term = makeTerm({
      sourceId: "t",
      season: "fall",
      year: 2025,
      termStart: "2025-09-01",
      termEnd: "2025-12-31",
      courseStart: "2025-09-08",
      courseEnd: "2025-12-05",
    });
    // After course end but before term end
    expect(isTermPassed(term, "2025-12-10")).toBe(false);
    // After term end
    expect(isTermPassed(term, "2026-01-01")).toBe(true);
  });
});

// ── selectDefaultTerm ──────────────────────────────────────────────────────

describe("selectDefaultTerm", () => {
  it("returns null for empty array", () => {
    expect(selectDefaultTerm([], "2025-09-15")).toBeNull();
  });

  it("prefers a term whose courseInterval contains today", () => {
    const terms = [
      makeTerm({
        sourceId: "current",
        season: "fall",
        year: 2025,
        termStart: "2025-09-01",
        termEnd: "2025-12-31",
        courseStart: "2025-09-08",
        courseEnd: "2025-12-05",
      }),
      makeTerm({
        sourceId: "future",
        season: "winter",
        year: 2026,
        termStart: "2026-01-01",
        termEnd: "2026-04-30",
        courseStart: "2026-01-12",
        courseEnd: "2026-04-10",
      }),
    ];
    // "2025-10-01" is inside courseInterval of "current"
    expect(selectDefaultTerm(terms, "2025-10-01")?.sourceId).toBe("current");
  });

  it("falls back to termInterval when no courseInterval contains today", () => {
    const terms = [
      makeTerm({
        sourceId: "interm",
        season: "fall",
        year: 2025,
        termStart: "2025-09-01",
        termEnd: "2025-12-31",
        courseStart: "2025-09-08",
        courseEnd: "2025-12-05",
      }),
    ];
    // After course end but inside term interval
    expect(selectDefaultTerm(terms, "2025-12-20")?.sourceId).toBe("interm");
  });

  it("selects nearest future term when today is past all term intervals", () => {
    const terms = [
      makeTerm({
        sourceId: "past",
        season: "fall",
        year: 2024,
        termStart: "2024-09-01",
        termEnd: "2024-12-31",
      }),
      makeTerm({
        sourceId: "near-future",
        season: "winter",
        year: 2025,
        termStart: "2025-01-06",
        termEnd: "2025-04-30",
      }),
      makeTerm({
        sourceId: "far-future",
        season: "fall",
        year: 2025,
        termStart: "2025-09-01",
        termEnd: "2025-12-31",
      }),
    ];
    // Today is between term intervals
    expect(selectDefaultTerm(terms, "2025-01-02")?.sourceId).toBe("near-future");
  });

  it("selects latest term when all terms are in the past", () => {
    const terms = [
      makeTerm({
        sourceId: "old",
        season: "winter",
        year: 2024,
        termStart: "2024-01-01",
        termEnd: "2024-04-30",
      }),
      makeTerm({
        sourceId: "newer",
        season: "fall",
        year: 2024,
        termStart: "2024-09-01",
        termEnd: "2024-12-31",
      }),
    ];
    // Today is past all terms
    expect(selectDefaultTerm(terms, "2025-01-01")?.sourceId).toBe("newer");
  });

  it("handles a single-term list", () => {
    const terms = [
      makeTerm({
        sourceId: "only",
        season: "fall",
        year: 2025,
        termStart: "2025-09-01",
        termEnd: "2025-12-31",
      }),
    ];
    expect(selectDefaultTerm(terms, "2026-01-01")?.sourceId).toBe("only");
    expect(selectDefaultTerm(terms, "2025-10-01")?.sourceId).toBe("only");
  });
});

// ── todayInToronto ─────────────────────────────────────────────────────────

describe("todayInToronto", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = todayInToronto();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a plausible date (year >= 2025)", () => {
    const year = Number.parseInt(todayInToronto().slice(0, 4), 10);
    expect(year).toBeGreaterThanOrEqual(2025);
  });
});

// ── importantDatesData helper edge cases ──────────────────────────────────

describe("data handling", () => {
  it("sorting and grouping work together on a mixed list", () => {
    const data: ImportantDatesData = {
      locale: "en",
      sourceUrl: "https://uottawa.ca/important-dates",
      terms: [
        makeTerm({ sourceId: "fall-2025", season: "fall", year: 2025, sourcePublished: "true" }),
        makeTerm({
          sourceId: "winter-2025",
          season: "winter",
          year: 2025,
          sourcePublished: "true",
        }),
        makeTerm({
          sourceId: "fall-2024",
          season: "fall",
          year: 2024,
          sourcePublished: "false",
        }),
        makeTerm({
          sourceId: "spring-2025",
          season: "spring-summer",
          year: 2025,
          sourcePublished: "true",
        }),
      ],
    };
    const sorted = sortImportantDateTerms(data.terms);
    const { current, historical } = groupTermsByPublication(sorted, "2024-02-01");
    expect(current.map((t) => t.sourceId)).toEqual(["winter-2025", "spring-2025", "fall-2025"]);
    expect(historical.map((t) => t.sourceId)).toEqual(["fall-2024"]);
  });
});
