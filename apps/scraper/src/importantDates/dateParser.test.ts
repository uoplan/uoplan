import { describe, expect, it } from "vitest";
import type { ImportantDateTerm } from "@uoplan/core/dataTypes";
import {
  classifyImportantDateEffect,
  isUndatedImportantDateText,
  parseImportantDateInterval,
  parseScheduleReplacement,
} from "./dateParser.ts";

type TermContext = Pick<ImportantDateTerm, "season" | "year">;

const WINTER_2026: TermContext = { season: "winter", year: 2026 };
const SPRING_SUMMER_2026: TermContext = { season: "spring-summer", year: 2026 };
const FALL_2023: TermContext = { season: "fall", year: 2023 };
const FALL_2026: TermContext = { season: "fall", year: 2026 };

describe("isUndatedImportantDateText", () => {
  it("recognizes intentional undated markers", () => {
    expect(isUndatedImportantDateText("N/A")).toBe(true);
    expect(isUndatedImportantDateText("NA")).toBe(true);
    expect(isUndatedImportantDateText("None")).toBe(true);
    expect(isUndatedImportantDateText("Consult your faculty or unit.")).toBe(true);
    expect(isUndatedImportantDateText("Consult your facuty or unit.")).toBe(true);
    expect(isUndatedImportantDateText("Consult the U-Pass website.")).toBe(true);
    expect(isUndatedImportantDateText("February 15 to 21")).toBe(false);
  });
});

describe("parseImportantDateInterval", () => {
  it("parses winter ranges and same-month shorthand dates", () => {
    expect(parseImportantDateInterval("January 1 to April 30 in Winter 2026", WINTER_2026)).toEqual(
      {
        startDate: "2026-01-01",
        endDate: "2026-04-30",
      },
    );

    expect(parseImportantDateInterval("February 15 to 21", WINTER_2026)).toEqual({
      startDate: "2026-02-15",
      endDate: "2026-02-21",
    });

    expect(parseImportantDateInterval("March 29 to April 1", WINTER_2026)).toEqual({
      startDate: "2026-03-29",
      endDate: "2026-04-01",
    });
  });

  it("parses explicit years and term-inferred cross-year ranges", () => {
    expect(parseImportantDateInterval("December 31, 2024 to January 2, 2025", WINTER_2026)).toEqual(
      {
        startDate: "2024-12-31",
        endDate: "2025-01-02",
      },
    );

    expect(parseImportantDateInterval("December 20 to January 10", FALL_2026)).toEqual({
      startDate: "2026-12-20",
      endDate: "2027-01-10",
    });
  });

  it("parses timed ranges and single-date wall-clock phrases", () => {
    expect(
      parseImportantDateInterval(
        "From 5 p.m. December 22, 2025, to 8:45 a.m. January 5, 2026",
        WINTER_2026,
      ),
    ).toEqual({
      startDate: "2025-12-22",
      endDate: "2026-01-05",
      startMinutes: 17 * 60,
      endMinutes: 8 * 60 + 45,
    });

    expect(
      parseImportantDateInterval("December 9, 2025, one minute past midnight", WINTER_2026),
    ).toEqual({
      startDate: "2025-12-09",
      endDate: "2025-12-09",
      startMinutes: 1,
    });

    expect(parseImportantDateInterval("September 2, 2026, starting at 8 a.m.", FALL_2026)).toEqual({
      startDate: "2026-09-02",
      endDate: "2026-09-02",
      startMinutes: 8 * 60,
    });

    expect(parseImportantDateInterval("September 2, 2026, starting at 10 a.m.", FALL_2026)).toEqual(
      {
        startDate: "2026-09-02",
        endDate: "2026-09-02",
        startMinutes: 10 * 60,
      },
    );

    expect(parseImportantDateInterval("April 1, 2024, starting at 9 a.m.", FALL_2023)).toEqual({
      startDate: "2024-04-01",
      endDate: "2024-04-01",
      startMinutes: 9 * 60,
    });
  });

  it("parses live wall-clock variants with missing punctuation", () => {
    expect(parseImportantDateInterval("June 19 2025, starting at 8 a.m.", WINTER_2026)).toEqual({
      startDate: "2025-06-19",
      endDate: "2025-06-19",
      startMinutes: 8 * 60,
    });

    expect(parseImportantDateInterval("May 19, 2026 starting at 8:30 a.m.", FALL_2026)).toEqual({
      startDate: "2026-05-19",
      endDate: "2026-05-19",
      startMinutes: 8 * 60 + 30,
    });

    expect(parseImportantDateInterval("August 12, 2025, starting at 9 a.m", FALL_2026)).toEqual({
      startDate: "2025-08-12",
      endDate: "2025-08-12",
      startMinutes: 9 * 60,
    });
  });

  it("normalizes nbsp and repeated whitespace", () => {
    expect(parseImportantDateInterval("February\u00a015   to\n\t21", WINTER_2026)).toEqual({
      startDate: "2026-02-15",
      endDate: "2026-02-21",
    });
  });

  it("returns null for intentionally undated values", () => {
    for (const text of ["N/A", "NA", "None", "Consult your faculty or unit."]) {
      expect(parseImportantDateInterval(text, WINTER_2026)).toBeNull();
    }
  });

  it("rejects invalid calendar dates instead of normalizing them", () => {
    expect(() => parseImportantDateInterval("February 30, 2026", WINTER_2026)).toThrow(
      /invalid calendar date/i,
    );
  });

  it("rejects same-day timed ranges whose end is earlier than their start", () => {
    expect(() =>
      parseImportantDateInterval(
        "From 5 p.m. January 5, 2026, to 8 a.m. January 5, 2026",
        WINTER_2026,
      ),
    ).toThrow(/start must not be after end/i);
  });
});

describe("parseScheduleReplacement", () => {
  it("parses Friday-to-Tuesday replacement rules and validates the usual weekday", () => {
    expect(
      parseScheduleReplacement(
        "Classes on Friday, April 3 due to Good Friday are cancelled. They will take place on Tuesday, April 14, when the usual Friday course schedule will apply.",
        WINTER_2026,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-04-03",
        replacementDate: "2026-04-14",
        sourceDay: "Fr",
      },
    });
  });

  it("parses cancelled-on / held-on schedule-change prose", () => {
    expect(
      parseScheduleReplacement(
        "Classes are cancelled on Monday, May 18 because of a holiday. They will be held on Saturday, May 23, when the usual Monday course schedule will apply.",
        SPRING_SUMMER_2026,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-05-18",
        replacementDate: "2026-05-23",
        sourceDay: "Mo",
      },
    });
  });

  it("parses live schedule-change prose with optional trailing notes and punctuation quirks", () => {
    expect(
      parseScheduleReplacement(
        "Classes on Friday, April 3, Good Friday and statutory holiday, are cancelled. They will take place on Tuesday, April 14, when the usual Friday course schedule will apply. Some exceptions may apply at both the undergraduate and graduate levels, please contact your faculty. Changes to regular course schedule don't affect CO-OP and clinical placements.",
        WINTER_2026,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-04-03",
        replacementDate: "2026-04-14",
        sourceDay: "Fr",
      },
    });

    expect(
      parseScheduleReplacement(
        "Classes are cancelled on Wednesday, July 1, in lieu of Canada Day (statutory holiday). They will be held on Saturday, July 4 when the usual Wednesday course schedule will apply. Some exceptions may apply at both the undergraduate and graduate levels, please contact your faculty. Changes to regular course schedule don't affect CO-OP and clinical placements.",
        SPRING_SUMMER_2026,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-07-01",
        replacementDate: "2026-07-04",
        sourceDay: "We",
      },
    });

    expect(
      parseScheduleReplacement(
        "Classes on Monday, October 12, Thanksgiving (a statutory holiday), are cancelled. They will take place on December 9, when the usual Monday course schedule will apply. This does not affect CO-OP and clinical placements",
        FALL_2026,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-10-12",
        replacementDate: "2026-12-09",
        sourceDay: "Mo",
      },
    });
  });

  it("parses schedule-change prose even when the dates cell is N/A", () => {
    expect(
      parseScheduleReplacement(
        "Classes on Monday, April 1 because of weather are cancelled. They will take place on Monday, April 8.",
        FALL_2023,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2024-04-01",
        replacementDate: "2024-04-08",
        sourceDay: "Mo",
      },
    });
  });

  it("infers the source day when the fall replacement prose omits the replacement weekday", () => {
    expect(
      parseScheduleReplacement(
        "Classes on Thursday, January 11 because of a closure are cancelled. They will take place on January 18, when the usual Thursday course schedule will apply.",
        FALL_2023,
      ),
    ).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2024-01-11",
        replacementDate: "2024-01-18",
        sourceDay: "Th",
      },
    });
  });

  it("returns not_applicable for empty schedule-change cells", () => {
    expect(parseScheduleReplacement("N/A", WINTER_2026)).toEqual({ kind: "not_applicable" });
    expect(parseScheduleReplacement("None", WINTER_2026)).toEqual({ kind: "not_applicable" });
  });

  it("returns an unsupported marker for prose it does not recognize", () => {
    expect(
      parseScheduleReplacement(
        "Classes are rescheduled. Please check with your professor for details.",
        WINTER_2026,
      ),
    ).toEqual({ kind: "unsupported" });
  });

  it("rejects weekday mismatches in cancelled, replacement, and usual-schedule prose", () => {
    expect(() =>
      parseScheduleReplacement(
        "Classes on Friday, April 2 are cancelled. They will take place on Tuesday, April 14, when the usual Friday course schedule will apply.",
        WINTER_2026,
      ),
    ).toThrow(/cancelled weekday/i);

    expect(() =>
      parseScheduleReplacement(
        "Classes on Friday, April 3 are cancelled. They will take place on Wednesday, April 14, when the usual Friday course schedule will apply.",
        WINTER_2026,
      ),
    ).toThrow(/replacement weekday/i);

    expect(() =>
      parseScheduleReplacement(
        "Classes on Friday, April 3 are cancelled. They will take place on Tuesday, April 14, when the usual Monday course schedule will apply.",
        WINTER_2026,
      ),
    ).toThrow(/usual course schedule/i);
  });
});

describe("classifyImportantDateEffect", () => {
  it("classifies categories and ACFAS-style notices semantically", () => {
    expect(
      classifyImportantDateEffect({
        category: "overview",
        topic: "Term structure",
        dateText: "January 1 to April 30 in Winter 2026",
      }),
    ).toBe("structural");

    const replacement = parseScheduleReplacement(
      "Classes on Friday, April 3 are cancelled. They will take place on Tuesday, April 14, when the usual Friday course schedule will apply.",
      WINTER_2026,
    );
    expect(replacement).toEqual({
      kind: "parsed",
      replacement: {
        cancelledDate: "2026-04-03",
        replacementDate: "2026-04-14",
        sourceDay: "Fr",
      },
    });

    expect(
      classifyImportantDateEffect({
        category: "schedule_changes",
        topic: "Replacement day",
        dateText: "Friday schedule moves to Tuesday",
        scheduleReplacement: replacement.kind === "parsed" ? replacement.replacement : null,
      }),
    ).toBe("schedule_replacement");

    expect(
      classifyImportantDateEffect({
        category: "schedule_changes",
        topic: "No replacement",
        dateText: "None",
      }),
    ).toBe("informational");

    expect(
      classifyImportantDateEffect({
        category: "breaks",
        topic: "Reading week",
        dateText: "February 15 to 21",
      }),
    ).toBe("no_classes");

    expect(
      classifyImportantDateEffect({
        category: "breaks",
        topic: "ACFAS conference week",
        dateText: "Courses are online and follow the regular schedule.",
      }),
    ).toBe("informational");

    expect(
      classifyImportantDateEffect({
        category: "other",
        topic: "Application deadline",
        dateText: "March 1",
      }),
    ).toBe("deadline");
  });
});
