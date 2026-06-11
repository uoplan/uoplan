import { describe, it, expect } from "vitest";
import {
  hasProfessorRatings,
  normalizeProfessorName,
  buildProfessorRatingsMap,
  getRatingsForInstructors,
  getRatingDetailsForInstructors,
  isSectionAllowedByMinRating,
  type ProfessorRatingsMap,
} from "../professorRatings";

describe("hasProfessorRatings", () => {
  it("accepts only entries with a positive, finite rating and at least one rating", () => {
    expect(hasProfessorRatings({ rating: 4.2, numRatings: 5 })).toBe(true);
    expect(hasProfessorRatings({ rating: 0, numRatings: 0 })).toBe(false); // unrated
    expect(hasProfessorRatings({ rating: 4, numRatings: 0 })).toBe(false); // no samples
    expect(hasProfessorRatings({ rating: 0, numRatings: 3 })).toBe(false); // 0 average
    expect(hasProfessorRatings({ rating: Number.NaN, numRatings: 3 })).toBe(false);
    expect(hasProfessorRatings(null)).toBe(false);
    expect(hasProfessorRatings(undefined)).toBe(false);
  });
});

describe("normalizeProfessorName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeProfessorName("  Jane   Q   Doe ")).toBe("Jane Q Doe");
    expect(normalizeProfessorName("")).toBe("");
  });
});

describe("buildProfessorRatingsMap", () => {
  it("keys by normalized name and coerces ratings, skipping empty names", () => {
    const map = buildProfessorRatingsMap({
      professors: [
        { name: "  Jane  Doe ", rating: 4.5, numRatings: 12, legacyId: 7 },
        { name: "No Rating", rating: null }, // null coerces to an unrated 0 entry
        { name: "", rating: 3 }, // empty name skipped
      ],
    });
    expect(map["Jane Doe"]).toEqual({ id: undefined, legacyId: 7, rating: 4.5, numRatings: 12 });
    // null rating becomes a 0/0 "unrated" entry (matches hasProfessorRatings semantics)
    expect(map["No Rating"]).toEqual({
      id: undefined,
      legacyId: undefined,
      rating: 0,
      numRatings: 0,
    });
    expect(hasProfessorRatings(map["No Rating"])).toBe(false);
    expect(Object.keys(map)).toEqual(["Jane Doe", "No Rating"]);
  });

  it("defaults numRatings to 0 when omitted", () => {
    const map = buildProfessorRatingsMap({ professors: [{ name: "A B", rating: 3 }] });
    expect(map["A B"].numRatings).toBe(0);
  });
});

const map: ProfessorRatingsMap = {
  "Jane Doe": { rating: 4.5, numRatings: 10 },
  "John Roe": { rating: 2.0, numRatings: 4 },
  Unrated: { rating: 0, numRatings: 0 },
};

describe("getRatingsForInstructors", () => {
  it("returns finite, rated values and de-duplicates instructors", () => {
    expect(getRatingsForInstructors(["Jane Doe", "Jane Doe", "John Roe"], map)).toEqual([4.5, 2.0]);
  });

  it("skips unrated and unknown instructors", () => {
    expect(getRatingsForInstructors(["Unrated", "Nobody"], map)).toEqual([]);
  });

  it("returns empty for missing map or instructors", () => {
    expect(getRatingsForInstructors(["Jane Doe"], null)).toEqual([]);
    expect(getRatingsForInstructors([], map)).toEqual([]);
    expect(getRatingsForInstructors(null, map)).toEqual([]);
  });
});

describe("getRatingDetailsForInstructors", () => {
  it("includes finite-rating entries (even 0-sample) with the trimmed display name", () => {
    const details = getRatingDetailsForInstructors(["  Jane Doe ", "Unrated"], map);
    expect(details).toEqual([
      { id: undefined, legacyId: undefined, name: "Jane Doe", rating: 4.5, numRatings: 10 },
      { id: undefined, legacyId: undefined, name: "Unrated", rating: 0, numRatings: 0 },
    ]);
  });
});

describe("isSectionAllowedByMinRating", () => {
  it("allows everything when no usable minimum is set", () => {
    expect(
      isSectionAllowedByMinRating({
        instructors: ["John Roe"],
        minRating: null,
        professorRatings: map,
      }),
    ).toBe(true);
    expect(
      isSectionAllowedByMinRating({
        instructors: ["John Roe"],
        minRating: Number.NaN,
        professorRatings: map,
      }),
    ).toBe(true);
  });

  it("allows sections whose instructors are all unrated (no rating => allowed)", () => {
    expect(
      isSectionAllowedByMinRating({
        instructors: ["Unrated", "Nobody"],
        minRating: 4,
        professorRatings: map,
      }),
    ).toBe(true);
  });

  it("requires every rated instructor to meet the minimum", () => {
    expect(
      isSectionAllowedByMinRating({
        instructors: ["Jane Doe"],
        minRating: 4,
        professorRatings: map,
      }),
    ).toBe(true);
    expect(
      isSectionAllowedByMinRating({
        instructors: ["Jane Doe", "John Roe"],
        minRating: 4,
        professorRatings: map,
      }),
    ).toBe(false); // John Roe is 2.0
  });
});
