import { describe, expect, it } from "vitest";
import type { Term } from "../dataTypes";
import { approximateTermStartYyyymmdd, defaultUpcomingTermId } from "../termDefaults";

const sampleTerms: Term[] = [
  { termId: "2261", name: "2026 Winter Term" },
  { termId: "2265", name: "2026 Spring/Summer Term" },
  { termId: "2269", name: "2026 Fall Term" },
  { termId: "2271", name: "2027 Winter Term" },
];

describe("approximateTermStartYyyymmdd", () => {
  it("maps seasons to nominal starts", () => {
    expect(approximateTermStartYyyymmdd(sampleTerms[0])).toBe(20260101);
    expect(approximateTermStartYyyymmdd(sampleTerms[1])).toBe(20260501);
    expect(approximateTermStartYyyymmdd(sampleTerms[2])).toBe(20260901);
    expect(approximateTermStartYyyymmdd(sampleTerms[3])).toBe(20270101);
  });

  it("returns null for unrecognized names", () => {
    expect(approximateTermStartYyyymmdd({ termId: "x", name: "unknown" })).toBeNull();
  });
});

describe("defaultUpcomingTermId", () => {
  it("picks the earliest term that has not started (by nominal date)", () => {
    expect(defaultUpcomingTermId(sampleTerms, new Date("2026-05-15"))).toBe("2269");
  });

  it("includes a term whose nominal start is today", () => {
    expect(defaultUpcomingTermId(sampleTerms, new Date("2026-09-01"))).toBe("2269");
  });

  it("before winter picks upcoming winter", () => {
    expect(defaultUpcomingTermId(sampleTerms, new Date("2025-12-01"))).toBe("2261");
  });

  it("when all nominal starts are in the past, uses the latest-listed term", () => {
    expect(defaultUpcomingTermId(sampleTerms, new Date("2028-01-01"))).toBe("2271");
  });
});
