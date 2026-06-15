import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { messages } from "@uoplan/i18n/catalogs/en";
import { messages as frMessages } from "@uoplan/i18n/catalogs/fr-CA";
import { tr } from "../i18n";
import {
  formatFilterHint,
  formatGenerationLead,
  formatGenerationMessage,
  formatSuggestion,
  formatSuggestions,
} from "./generationDiagnosticsText";
import type { SuggestionCode, TimetableFailureDiagnostics } from "@uoplan/core";

const ALL_SUGGESTION_CODES: SuggestionCode[] = [
  "relax-filters",
  "try-different-course",
  "turn-off-compressed",
  "clear-min-rating",
  "widen-hours-days",
  "relax-fy-cap",
  "un-blacklist",
  "widen-or-change-picks",
  "combined-blockers-intro",
  "structural-conflict",
];

beforeAll(() => {
  i18n.load("en", messages);
  i18n.load("fr-CA", frMessages);
  i18n.activate("en");
});

describe("generationDiagnosticsText", () => {
  it("formats a named-sections lead", () => {
    expect(
      formatGenerationLead({ code: "no-sections-named", courses: ["CSI 2110", "SEG 2105"] }),
    ).toBe("No sections match your filters: CSI 2110, SEG 2105.");
  });

  it("collapses a long lead course list to +N more", () => {
    expect(
      formatGenerationLead({
        code: "no-sections-named",
        courses: ["A 1", "B 2", "C 3", "D 4", "E 5", "F 6"],
      }),
    ).toBe("No sections match your filters: A 1, B 2, C 3, D 4 +2 more.");
  });

  it("formats the too-few lead with counts", () => {
    expect(formatGenerationLead({ code: "too-few-courses", eligible: 1, target: 3 })).toBe(
      "Only 1/3 courses have valid sections.",
    );
  });

  it("maps every suggestion code to a non-empty, non-identity string", () => {
    for (const code of ALL_SUGGESTION_CODES) {
      const text = formatSuggestion(code);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toBe(code);
    }
  });

  it("formats suggestions from a diagnostics object in order", () => {
    const tf = {
      suggestions: ["turn-off-compressed", "clear-min-rating"],
    } as unknown as TimetableFailureDiagnostics;
    expect(formatSuggestions(tf)).toEqual([
      "Turn off Compressed schedule.",
      "Clear minimum professor rating.",
    ]);
  });

  it("renders nested ICU plural for blocked-pool candidates", () => {
    expect(tr("gen.pools.blockedByFilters", { count: 1, courses: "MAT 1341" })).toBe(
      "— MAT 1341 qualifies but is blocked by current filters",
    );
    expect(tr("gen.pools.blockedByFilters", { count: 2, courses: "MAT 1341 or PHY 1124" })).toBe(
      "— MAT 1341 or PHY 1124 qualify but are blocked by current filters",
    );
  });

  it("renders the French catalog for the same code", () => {
    i18n.activate("fr-CA");
    expect(formatSuggestion("turn-off-compressed")).toBe("Désactivez l'horaire compact.");
    i18n.activate("en");
  });

  it("formats structured error-message descriptors", () => {
    expect(formatGenerationMessage({ kind: "complete-assign" })).toBe(
      "Complete Assign requirements before generating schedules.",
    );
    expect(formatGenerationMessage({ kind: "not-enough-courses" })).toBe(
      "Not enough courses match your filters.",
    );
    expect(
      formatGenerationMessage({
        kind: "lead",
        lead: { code: "structural-conflict" },
      }),
    ).toBe(formatGenerationLead({ code: "structural-conflict" }));
    expect(
      formatGenerationMessage({
        kind: "unassigned-completed",
        count: 1,
        preview: ["CSI 2110"],
        overflow: 0,
      }),
    ).toContain("CSI 2110");
    const overflowMsg = formatGenerationMessage({
      kind: "unassigned-completed",
      count: 14,
      preview: ["A 1", "B 2"],
      overflow: 2,
    });
    expect(overflowMsg).toContain("A 1, B 2 (+2 more)");
  });

  it("formats every active-filter hint variant", () => {
    expect(formatFilterHint({ code: "start-after", time: "10:30" })).toBe(
      "Start time restricted to after 10:30",
    );
    expect(formatFilterHint({ code: "end-before", time: "16:00" })).toBe(
      "End time restricted to before 16:00",
    );
    expect(formatFilterHint({ code: "days-excluded", days: ["Mo", "Fr"] })).toBe(
      "Days excluded: Mon, Fri",
    );
    expect(formatFilterHint({ code: "prof-rating", rating: 3.5 })).toBe("Professor rating ≥ 3.5");
    expect(formatFilterHint({ code: "virtual-only" })).toBe("Virtual sections only");
    expect(formatFilterHint({ code: "language-filter", langs: ["fr", "other"] })).toBe(
      "Language filter: French, Other only",
    );
  });
});
