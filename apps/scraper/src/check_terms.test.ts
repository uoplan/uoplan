import { describe, expect, it } from "vitest";
import { findNewTerms, parseTermDropdown, sortTerms, termsListsEqual } from "./terms/check.ts";
import { normalizeTermName } from "./terms/normalize.ts";

describe("normalizeTermName", () => {
  it("collapses Spring/Summer to Summer", () => {
    expect(normalizeTermName("2026 Spring/Summer Term")).toBe("2026 Summer Term");
  });

  it("tolerates spacing around the slash and is case-insensitive", () => {
    expect(normalizeTermName("2026 spring / summer Term")).toBe("2026 Summer Term");
  });

  it("leaves other term names unchanged", () => {
    expect(normalizeTermName("2026 Fall Term")).toBe("2026 Fall Term");
    expect(normalizeTermName("2027 Winter Term")).toBe("2027 Winter Term");
  });
});

describe("parseTermDropdown", () => {
  it("extracts term IDs and names from a select element", () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="">Select a term</option>
        <option value="2261">2026 Winter Term</option>
        <option value="2265">2026 Spring/Summer Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2265", name: "2026 Summer Term" },
    ]);
  });

  it("skips blank option values", () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value=""> </option>
        <option value="2261">2026 Winter Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([{ termId: "2261", name: "2026 Winter Term" }]);
  });

  it("deduplicates by termId", () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="2261">2026 Winter Term</option>
        <option value="2261">2026 Winter Term (duplicate)</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toHaveLength(1);
  });

  it("returns empty array when select element is missing", () => {
    expect(parseTermDropdown("<html></html>")).toEqual([]);
  });
});

describe("sortTerms", () => {
  it("sorts by termId", () => {
    const terms = [
      { termId: "2269", name: "2026 Fall Term" },
      { termId: "2261", name: "2026 Winter Term" },
    ];
    expect(sortTerms(terms)).toEqual([
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2269", name: "2026 Fall Term" },
    ]);
  });
});

describe("findNewTerms", () => {
  it("returns only term IDs not in known list", () => {
    const known = [
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2265", name: "2026 Spring/Summer Term" },
    ];
    const current = [
      { termId: "2265", name: "2026 Spring/Summer Term" },
      { termId: "2269", name: "2026 Fall Term" },
    ];
    expect(findNewTerms(known, current)).toEqual([{ termId: "2269", name: "2026 Fall Term" }]);
  });

  it("returns empty when all current terms are known", () => {
    const known = [{ termId: "2261", name: "2026 Winter Term" }];
    expect(findNewTerms(known, known)).toEqual([]);
  });
});

describe("termsListsEqual", () => {
  it("is true for same terms in different order", () => {
    const a = [
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2265", name: "2026 Spring/Summer Term" },
    ];
    const b = [
      { termId: "2265", name: "2026 Spring/Summer Term" },
      { termId: "2261", name: "2026 Winter Term" },
    ];
    expect(termsListsEqual(a, b)).toBe(true);
  });

  it("is false when a term was removed", () => {
    const known = [
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2265", name: "2026 Spring/Summer Term" },
    ];
    const current = [{ termId: "2265", name: "2026 Spring/Summer Term" }];
    expect(termsListsEqual(known, current)).toBe(false);
  });

  it("is false when a term name changed", () => {
    const known = [{ termId: "2261", name: "2026 Winter Term" }];
    const current = [{ termId: "2261", name: "2026 Winter Session" }];
    expect(termsListsEqual(known, current)).toBe(false);
  });

  it("detects replacement: known A,B,C vs current B,C,D — only D is new", () => {
    const known = [
      { termId: "2261", name: "2026 Winter Term" },
      { termId: "2265", name: "2026 Spring/Summer Term" },
      { termId: "2269", name: "2026 Fall Term" },
    ];
    const current = [
      { termId: "2265", name: "2026 Spring/Summer Term" },
      { termId: "2269", name: "2026 Fall Term" },
      { termId: "2271", name: "2027 Winter Term" },
    ];
    expect(termsListsEqual(known, current)).toBe(false);
    expect(findNewTerms(known, current)).toEqual([{ termId: "2271", name: "2027 Winter Term" }]);
  });
});
