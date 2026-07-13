import { describe, expect, it } from "vitest";
import type { GeneratedSchedule } from "@uoplan/core";
import { ImportantDatesExportError, normalizeCourseCode } from "@uoplan/core";
import type {
  ImportantDateItem,
  ImportantDatesData,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { buildScheduleExport, resolveImportantDateTermsForSegments } from "./scheduleExport";
import type { ScheduleExportRequest, ScheduleExportSegment } from "./scheduleExport";

/**
 * Minimal, real `GeneratedSchedule` fixture (mirrors `packages/ics/src/ics.test.ts`):
 * one weekly Monday lecture. `cache: null` is used throughout since
 * `scheduleToCalendarEvents` degrades gracefully without a cache.
 */
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
                  instructor: null,
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

function segment(
  key: string,
  overrides: Partial<Omit<ScheduleExportSegment, "key">> = {},
): ScheduleExportSegment {
  return {
    key,
    schedule: makeSchedule("CSI 2132"),
    startDate: "2026-01-12",
    endDate: "2026-04-15",
    ...overrides,
  };
}

function request(overrides: Partial<ScheduleExportRequest> = {}): ScheduleExportRequest {
  return {
    scope: "single",
    segments: [segment("2261")],
    cache: null,
    filename: "uoplan-winter-2026-2026-01-12-to-2026-04-15.ics",
    ...overrides,
  };
}

function makeItem(
  effect: ImportantDateItem["effect"],
  overrides: Partial<ImportantDateItem> = {},
): ImportantDateItem {
  return { id: "item-1", topic: "Untitled", dateText: "", effect, ...overrides };
}

function makeTerm(
  termId: string,
  season: ImportantDateTerm["season"],
  year: number,
  items: ImportantDateItem[] = [],
): ImportantDateTerm {
  return {
    sourceId: `source-${termId}`,
    termId,
    label: `${season} ${year}`,
    season,
    year,
    sourcePublished: "true",
    termInterval: { startDate: "2026-01-01", endDate: "2026-04-30" },
    courseInterval: { startDate: "2026-01-12", endDate: "2026-04-13" },
    sessions: [],
    sections:
      items.length > 0
        ? [
            {
              id: "s1",
              label: "Important Dates",
              category: "breaks",
              groups: [{ id: "g1", items }],
            },
          ]
        : [],
  };
}

function makeData(terms: ImportantDateTerm[]): ImportantDatesData {
  return { locale: "en", sourceUrl: "https://example.test/dates", terms };
}

/** Winter 2026 term with a mandatory `no_classes` break plus an optional `deadline`. */
function makeWinterTermWithBreakAndDeadline(): ImportantDateTerm {
  return makeTerm("2261", "winter", 2026, [
    makeItem("no_classes", {
      id: "family-day",
      topic: "Family Day",
      interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
    }),
    makeItem("deadline", {
      id: "add-drop",
      topic: "Add/drop deadline",
      interval: { startDate: "2026-01-23", endDate: "2026-01-23" },
    }),
  ]);
}

function expectImportantDatesError(action: () => unknown): ImportantDatesExportError {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ImportantDatesExportError);
  return thrown as ImportantDatesExportError;
}

describe("scheduleExport module", () => {
  it("runs in a DOM-free environment, proving it never reaches the browser download boundary", () => {
    // The web app's "unit" vitest project runs under Node (no jsdom). If this
    // module ever touched document/window/downloadTextFile, every test below
    // would throw a ReferenceError rather than exercising real logic.
    expect(typeof document).toBe("undefined");
  });

  describe("buildScheduleExport", () => {
    it("invokes the single-schedule builder for exactly one segment and passes through filename/scope", () => {
      const result = buildScheduleExport(request());

      expect(result.filename).toBe("uoplan-winter-2026-2026-01-12-to-2026-04-15.ics");
      expect(result.scope).toBe("single");
      expect(result.ics).toContain("BEGIN:VCALENDAR\r\n");
      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
      // Single-segment output has no segment-key UID prefix.
      expect(result.ics).toContain("UID:CSI 2132-LEC-Mo-540-600@uoplan");
    });

    it("invokes the combined builder for multiple segments, keeping each one's own bounds and disambiguating UIDs", () => {
      const result = buildScheduleExport(
        request({
          scope: "all",
          segments: [
            segment("2251", { startDate: "2025-09-03", endDate: "2025-12-05" }),
            segment("2255", { startDate: "2026-01-12", endDate: "2026-04-15" }),
          ],
          filename: "uoplan-plan-2025-09-03-to-2026-04-15.ics",
        }),
      );

      expect(result.scope).toBe("all");
      expect(result.filename).toBe("uoplan-plan-2025-09-03-to-2026-04-15.ics");
      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
      expect(result.ics).toContain("UID:2251-CSI 2132-LEC-Mo-540-600@uoplan");
      expect(result.ics).toContain("UID:2255-CSI 2132-LEC-Mo-540-600@uoplan");
      expect(result.ics).toContain("UNTIL=20251207T000000Z");
      expect(result.ics).toContain("UNTIL=20260417T000000Z");
    });

    it('dispatches by request.scope, not segment count: scope "all" with exactly one segment still uses the combined/prefixed-UID builder', () => {
      const result = buildScheduleExport(
        request({
          scope: "all",
          segments: [segment("2261")],
          filename: "uoplan-plan-2026-01-12-to-2026-04-15.ics",
        }),
      );

      expect(result.scope).toBe("all");
      expect(result.filename).toBe("uoplan-plan-2026-01-12-to-2026-04-15.ics");
      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
      // "all" scope always disambiguates by segment key, even for a single segment —
      // this is the compatibility contract `downloadAllTermsIcs` previously relied on.
      expect(result.ics).toContain("UID:2261-CSI 2132-LEC-Mo-540-600@uoplan");
      expect(result.ics).not.toContain("UID:CSI 2132-LEC-Mo-540-600@uoplan");
    });

    it("is deterministic: calling twice with the same request yields byte-identical output", () => {
      const req = request({
        scope: "all",
        segments: [segment("2251"), segment("2255")],
      });

      expect(buildScheduleExport(req).ics).toBe(buildScheduleExport(req).ics);
    });

    it("throws when the request has no segments", () => {
      expect(() => buildScheduleExport(request({ segments: [] }))).toThrow(/at least one segment/i);
    });

    it('throws when scope is "all" but the request has no segments (zero is rejected regardless of scope)', () => {
      expect(() => buildScheduleExport(request({ scope: "all", segments: [] }))).toThrow(
        /at least one segment/i,
      );
    });

    it('throws when scope is "single" but the request has more than one segment', () => {
      expect(() =>
        buildScheduleExport(
          request({ scope: "single", segments: [segment("2251"), segment("2255")] }),
        ),
      ).toThrow(/scope "single".*exactly one segment/i);
    });

    it("throws when the request has duplicate segment keys, regardless of important dates", () => {
      expect(() =>
        buildScheduleExport(
          request({ scope: "all", segments: [segment("2261"), segment("2261")] }),
        ),
      ).toThrow(/duplicate/i);
    });
  });

  describe("resolveImportantDateTermsForSegments", () => {
    it("resolves each segment to the term whose termId matches exactly (not label or date)", () => {
      const winterTerm = makeTerm("2261", "winter", 2026);
      const fallTerm = makeTerm("2269", "fall", 2026);
      const data = makeData([fallTerm, winterTerm]);

      const resolved = resolveImportantDateTermsForSegments(
        [segment("2261"), segment("2269", { startDate: "2025-09-03", endDate: "2025-12-05" })],
        data,
      );

      expect(resolved.get("2261")).toBe(winterTerm);
      expect(resolved.get("2269")).toBe(fallTerm);
    });

    it("fails with a typed, actionable error when no term matches a segment's key", () => {
      const data = makeData([makeTerm("2269", "fall", 2026)]);

      const error = expectImportantDatesError(() =>
        resolveImportantDateTermsForSegments([segment("2261")], data),
      );

      expect(error.code).toBe("missing-term");
      expect(error.message).toContain("2261");
    });

    it("fails when more than one term shares the same termId (ambiguous match)", () => {
      const data = makeData([makeTerm("2261", "winter", 2026), makeTerm("2261", "winter", 2026)]);

      const error = expectImportantDatesError(() =>
        resolveImportantDateTermsForSegments([segment("2261")], data),
      );

      expect(error.code).toBe("missing-term");
      expect(error.message).toContain("2261");
    });

    it("fails when the same segment key is requested twice (identity mismatch)", () => {
      const data = makeData([makeTerm("2261", "winter", 2026)]);

      const error = expectImportantDatesError(() =>
        resolveImportantDateTermsForSegments([segment("2261"), segment("2261")], data),
      );

      expect(error.code).toBe("missing-term");
      expect(error.message).toContain("2261");
    });
  });

  describe("buildScheduleExport with important dates", () => {
    it("fails before producing any ICS output when a segment has no matching important-date term", () => {
      const data = makeData([makeTerm("2269", "fall", 2026)]);

      const error = expectImportantDatesError(() =>
        buildScheduleExport(request(), { data, includeDeadlines: false }),
      );

      expect(error.code).toBe("missing-term");
      expect(error.message).toContain("2261");
    });

    it("single output: applies the mandatory no_classes closure even when includeDeadlines is false", () => {
      const data = makeData([makeWinterTermWithBreakAndDeadline()]);

      const result = buildScheduleExport(request(), { data, includeDeadlines: false });

      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
      expect(result.ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
      expect(result.ics).not.toContain("Add/drop deadline");
    });

    it("single output: also includes deadline rows when includeDeadlines is true", () => {
      const data = makeData([makeWinterTermWithBreakAndDeadline()]);

      const result = buildScheduleExport(request(), { data, includeDeadlines: true });

      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
      expect(result.ics).toContain("SUMMARY:Add/drop deadline\r\n");
    });

    it("combined output: applies each segment's own term transforms with no cross-term leakage", () => {
      const fallTerm = makeTerm("2251", "fall", 2025, [
        makeItem("no_classes", {
          id: "fall-break",
          topic: "Fall break",
          interval: { startDate: "2025-10-13", endDate: "2025-10-13" },
        }),
      ]);
      const winterTerm = makeTerm("2255", "winter", 2026, [
        makeItem("no_classes", {
          id: "family-day",
          topic: "Family Day",
          interval: { startDate: "2026-02-16", endDate: "2026-02-16" },
        }),
      ]);
      const data = makeData([fallTerm, winterTerm]);

      const result = buildScheduleExport(
        request({
          scope: "all",
          segments: [
            segment("2251", { startDate: "2025-09-03", endDate: "2025-12-05" }),
            segment("2255", { startDate: "2026-01-12", endDate: "2026-04-15" }),
          ],
        }),
        { data, includeDeadlines: false },
      );

      // Two course events plus one all-day marker per segment — never the other segment's rule.
      expect(result.ics.match(/BEGIN:VEVENT/g)?.length).toBe(4);
      expect(result.ics).toContain("SUMMARY:Fall break\r\n");
      expect(result.ics).toContain("SUMMARY:Family Day\r\n");
      expect(result.ics).toContain("EXDATE;TZID=America/Toronto:20251013T090000\r\n");
      expect(result.ics).toContain("EXDATE;TZID=America/Toronto:20260216T090000\r\n");
    });
  });
});
