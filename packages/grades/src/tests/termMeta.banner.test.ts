import { describe, expect, it } from "vitest";
import { decodeTermMeta } from "../gradeTrends";

describe("decodeTermMeta accepts both school term-id formats", () => {
  it("decodes uOttawa PeopleSoft 4-digit ids", () => {
    expect(decodeTermMeta(2179)).toMatchObject({ year: 2017, season: "fall", seasonDigit: 9 });
    expect(decodeTermMeta(2251)).toMatchObject({ year: 2025, season: "winter", seasonDigit: 1 });
    expect(decodeTermMeta(2245)).toMatchObject({ year: 2024, season: "springSummer" });
  });

  it("decodes Carleton Banner 6-digit ids", () => {
    expect(decodeTermMeta(202710)).toMatchObject({ year: 2027, season: "winter", seasonDigit: 1 });
    expect(decodeTermMeta(202620)).toMatchObject({
      year: 2026,
      season: "springSummer",
      seasonDigit: 5,
    });
    expect(decodeTermMeta(202630)).toMatchObject({ year: 2026, season: "fall", seasonDigit: 9 });
  });

  it("orders Banner ids chronologically via sortKey", () => {
    const ids = [202710, 202620, 202630];
    const sorted = [...ids].sort((a, b) => decodeTermMeta(a).sortKey - decodeTermMeta(b).sortKey);
    expect(sorted).toEqual([202620, 202630, 202710]);
  });

  it("returns a null season for unknown Banner term codes", () => {
    expect(decodeTermMeta(202699).season).toBeNull();
  });
});
