import { describe, expect, it } from "vitest";
import { labelToTermId, parseTermLabel } from "./termId.ts";

describe("labelToTermId", () => {
  it("maps the canonical seasons verified against terms.json", () => {
    expect(labelToTermId("Fall 2026")).toBe("2269");
    expect(labelToTermId("Winter 2027")).toBe("2271");
    expect(labelToTermId("Spring/Summer 2026")).toBe("2265");
  });

  it("maps Fall 2025 to the most recent grades term", () => {
    expect(labelToTermId("Fall 2025")).toBe("2259");
  });

  it("handles Winter / Spring/Summer of the same display year", () => {
    expect(labelToTermId("Winter 2026")).toBe("2261");
    expect(labelToTermId("Spring/Summer 2025")).toBe("2255");
    expect(labelToTermId("Fall 2014")).toBe("2149");
  });

  it("accepts loose spacing and standalone Spring or Summer", () => {
    expect(labelToTermId("Spring / Summer 2024")).toBe("2245");
    expect(labelToTermId("Summer 2024")).toBe("2245");
    expect(labelToTermId("Spring 2024")).toBe("2245");
  });

  it("returns parsed parts", () => {
    expect(parseTermLabel("Fall 2025")).toEqual({ season: "fall", year: 2025, termId: "2259" });
  });

  it("returns null for unrecognized labels", () => {
    expect(labelToTermId("Applications")).toBeNull();
    expect(labelToTermId("")).toBeNull();
  });
});
