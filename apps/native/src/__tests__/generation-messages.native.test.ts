import type {
  SuggestionCode,
  TimetableFailureDiagnostics,
} from "@uoplan/core/generationDiagnostics";

import {
  formatGenerationLead,
  formatSuggestion,
  formatSuggestions,
} from "@/lib/generation-messages";

// The native i18n adapter (`@/i18n`) loads every catalog and activates `en`
// synchronously on import, so `tr()` resolves real English strings here.

const ALL_SUGGESTION_CODES: SuggestionCode[] = [
  "relax-filters",
  "try-different-course",
  "turn-off-compressed",
  "widen-hours-days",
  "relax-fy-cap",
  "un-blacklist",
  "widen-or-change-picks",
  "combined-blockers-intro",
  "structural-conflict",
];

describe("generation-messages", () => {
  it("formats a named-sections lead from the shared catalog", () => {
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

  it("falls back to the generic no-clash-free lead", () => {
    expect(formatGenerationLead({ code: "no-clash-free" })).toBe(
      "No clash-free timetable with your current settings.",
    );
  });

  it("maps every suggestion code to a non-empty, non-identity string", () => {
    for (const code of ALL_SUGGESTION_CODES) {
      const text = formatSuggestion(code);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toBe(code);
    }
  });

  it("formats a diagnostics object's suggestions in order", () => {
    const tf = {
      suggestions: ["relax-filters", "try-different-course"],
    } as unknown as TimetableFailureDiagnostics;
    expect(formatSuggestions(tf)).toEqual([
      "Relax time window, professor rating, or allowed days.",
      "No timetable posted yet? Try a different course or check back later.",
    ]);
  });
});
