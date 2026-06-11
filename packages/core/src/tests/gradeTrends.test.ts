import { describe, expect, it } from "vitest";
import {
  availableDisciplines,
  computeCourseLeaderboard,
  computeDisciplineLeaderboard,
  computeGradeTrends,
  decodeTermMeta,
} from "../gradeTrends";
import type { CourseGradesData } from "../dataTypes";
import { disciplineOf, levelOf, normalizeCourseCode } from "../utils/courseUtils";

describe("decodeTermMeta", () => {
  it("decodes year and season from PeopleSoft term ids", () => {
    expect(decodeTermMeta(2179)).toMatchObject({ year: 2017, season: "fall", seasonDigit: 9 });
    expect(decodeTermMeta(2231)).toMatchObject({ year: 2023, season: "winter", seasonDigit: 1 });
    expect(decodeTermMeta(2255)).toMatchObject({
      year: 2025,
      season: "springSummer",
      seasonDigit: 5,
    });
  });

  it("orders Winter < Spring/Summer < Fall within a year and across years", () => {
    const winter = decodeTermMeta(2231).sortKey; // Winter 2023
    const spring = decodeTermMeta(2235).sortKey; // Spring 2023
    const fall = decodeTermMeta(2239).sortKey; // Fall 2023
    const nextWinter = decodeTermMeta(2241).sortKey; // Winter 2024
    expect(winter).toBeLessThan(spring);
    expect(spring).toBeLessThan(fall);
    expect(fall).toBeLessThan(nextWinter);
  });

  it("returns a null season for unrecognised ids", () => {
    expect(decodeTermMeta(0)).toMatchObject({ year: 0, season: null });
    expect(decodeTermMeta(12345)).toMatchObject({ season: null });
  });
});

describe("disciplineOf / levelOf", () => {
  it("extracts discipline and level from course codes", () => {
    expect(disciplineOf(normalizeCourseCode("PSY 1101"))).toBe("PSY");
    expect(disciplineOf("psy1101")).toBe("PSY");
    expect(levelOf(normalizeCourseCode("PSY 1101"))).toBe(1000);
    expect(levelOf(normalizeCourseCode("ADM 4302"))).toBe(4000);
    expect(disciplineOf("not a code")).toBeNull();
  });
});

const grades: CourseGradesData = {
  courses: [
    {
      code: normalizeCourseCode("PSY 1101"),
      professors: [
        // Fall 2017: all A+ → GPA 10, 100% A+, 100% A-range, 100% pass
        { name: "P One", termId: 2179, distribution: { "A+": 100 } },
        // Winter 2023: half A+, half F → GPA 5, 50% A+, 50% pass
        { name: "P Two", termId: 2231, distribution: { "A+": 50, F: 50 } },
      ],
    },
    {
      code: normalizeCourseCode("PSY 2301"),
      professors: [
        // Winter 2023, level 2000: all B (6) → GPA 6
        { name: "P Three", termId: 2231, distribution: { B: 80 } },
      ],
    },
    {
      code: normalizeCourseCode("ADM 1100"),
      professors: [
        // Fall 2017: all C (4)
        { name: "A One", termId: 2179, distribution: { C: 60 } },
        // Winter 2023: all A (9)
        { name: "A Two", termId: 2231, distribution: { A: 90 } },
      ],
    },
  ],
};

describe("computeGradeTrends", () => {
  it("aggregates per term with 10-point GPA and percentages", () => {
    const { points } = computeGradeTrends(grades, { discipline: "PSY" });
    expect(points.map((p) => p.termId)).toEqual([2179, 2231]);

    const fall = points[0];
    expect(fall.gpa).toBeCloseTo(10, 5);
    expect(fall.aPlusPct).toBeCloseTo(100, 5);
    expect(fall.aRangePct).toBeCloseTo(100, 5);
    expect(fall.passPct).toBeCloseTo(100, 5);
    expect(fall.volume).toBe(100);

    // Winter 2023 PSY: A+ (50) + F (50) from 1101, B (80) from 2301 → mass 180
    const winter = points[1];
    expect(winter.volume).toBe(180);
    expect(winter.gpa).toBeCloseTo((10 * 50 + 0 * 50 + 6 * 80) / 180, 5);
    expect(winter.aPlusPct).toBeCloseTo((50 / 180) * 100, 5);
    expect(winter.passPct).toBeCloseTo(((180 - 50) / 180) * 100, 5);
  });

  it("filters by level", () => {
    const { points } = computeGradeTrends(grades, { discipline: "PSY", level: 2000 });
    expect(points).toHaveLength(1);
    expect(points[0].termId).toBe(2231);
    expect(points[0].gpa).toBeCloseTo(6, 5);
  });

  it("filters by season", () => {
    const { points } = computeGradeTrends(grades, { season: "fall" });
    expect(points.map((p) => p.termId)).toEqual([2179]);
    // Fall 2017 across disciplines: PSY A+ (100) + ADM C (60) → mass 160
    expect(points[0].volume).toBe(160);
  });

  it("returns chronologically ordered points across all disciplines", () => {
    const { points } = computeGradeTrends(grades);
    expect(points.map((p) => p.sortKey)).toEqual(
      [...points.map((p) => p.sortKey)].sort((a, b) => a - b),
    );
  });
});

describe("computeDisciplineLeaderboard", () => {
  it("computes earliest vs latest GPA delta with a volume guard", () => {
    const board = computeDisciplineLeaderboard(grades, { minTermVolume: 50, minTerms: 2 });
    const adm = board.find((d) => d.discipline === "ADM");
    expect(adm).toBeDefined();
    // ADM: Fall 2017 all C (4), Winter 2023 all A (9) → delta +5
    expect(adm?.earliestGpa).toBeCloseTo(4, 5);
    expect(adm?.currentGpa).toBeCloseTo(9, 5);
    expect(adm?.gpaDelta).toBeCloseTo(5, 5);
    expect(adm?.qualifyingTerms).toBe(2);
    expect(adm?.firstYear).toBe(2017);
    expect(adm?.lastYear).toBe(2023);
  });

  it("reports null delta when fewer than minTerms qualify", () => {
    const board = computeDisciplineLeaderboard(grades, { minTermVolume: 150, minTerms: 2 });
    // PSY Winter 2023 mass is 180 (qualifies); Fall 2017 mass 100 (does not).
    const psy = board.find((d) => d.discipline === "PSY");
    expect(psy?.qualifyingTerms).toBe(1);
    expect(psy?.gpaDelta).toBeNull();
    expect(psy?.currentGpa).not.toBeNull();
  });

  it("drops disciplines with no qualifying term", () => {
    const board = computeDisciplineLeaderboard(grades, { minTermVolume: 10_000 });
    expect(board).toHaveLength(0);
  });

  it("honours the level filter", () => {
    const board = computeDisciplineLeaderboard(grades, { minTermVolume: 50, level: 2000 });
    // Only PSY 2301 (level 2000) contributes; ADM/PSY 1000-level excluded.
    expect(board.map((d) => d.discipline)).toEqual(["PSY"]);
    expect(board[0].currentGpa).toBeCloseTo(6, 5);
  });

  it("honours the season filter", () => {
    const board = computeDisciplineLeaderboard(grades, { minTermVolume: 50, season: "fall" });
    // Fall 2017 only: PSY 1101 (A+) and ADM 1100 (C); each a single qualifying term.
    expect(board.map((d) => d.discipline).sort()).toEqual(["ADM", "PSY"]);
    for (const row of board) {
      expect(row.qualifyingTerms).toBe(1);
      expect(row.gpaDelta).toBeNull();
    }
  });
});

describe("computeCourseLeaderboard", () => {
  it("groups by course code instead of discipline", () => {
    const board = computeCourseLeaderboard(grades, {}, { minTermVolume: 50, minTerms: 2 });
    expect(board.map((c) => c.code).sort()).toEqual([
      normalizeCourseCode("ADM 1100"),
      normalizeCourseCode("PSY 1101"),
      normalizeCourseCode("PSY 2301"),
    ]);
    const psy1101 = board.find((c) => c.code === normalizeCourseCode("PSY 1101"));
    // PSY 1101: Fall 2017 all A+ (10) → Winter 2023 half A+/half F (5) → delta -5.
    expect(psy1101?.earliestGpa).toBeCloseTo(10, 5);
    expect(psy1101?.currentGpa).toBeCloseTo(5, 5);
    expect(psy1101?.gpaDelta).toBeCloseTo(-5, 5);
  });

  it("keeps a row with null delta when a course has a single term", () => {
    const board = computeCourseLeaderboard(grades, {}, { minTermVolume: 50, minTerms: 2 });
    const psy2301 = board.find((c) => c.code === normalizeCourseCode("PSY 2301"));
    expect(psy2301).toBeDefined();
    expect(psy2301?.qualifyingTerms).toBe(1);
    expect(psy2301?.gpaDelta).toBeNull();
    expect(psy2301?.currentGpa).toBeCloseTo(6, 5);
  });

  it("still lists matched courses below the per-term volume guard", () => {
    const board = computeCourseLeaderboard(grades, {}, { minTermVolume: 10_000 });
    // No term clears the guard, but every course with grade data still appears.
    expect(board.map((c) => c.code).sort()).toEqual([
      normalizeCourseCode("ADM 1100"),
      normalizeCourseCode("PSY 1101"),
      normalizeCourseCode("PSY 2301"),
    ]);
  });

  it("restricts to explicit program-filter course codes", () => {
    const board = computeCourseLeaderboard(
      grades,
      { programFilter: { codes: new Set([normalizeCourseCode("PSY 1101")]), pools: [] } },
      { minTermVolume: 50 },
    );
    expect(board.map((c) => c.code)).toEqual([normalizeCourseCode("PSY 1101")]);
  });

  it("expands program-filter discipline pools to matching courses", () => {
    const board = computeCourseLeaderboard(
      grades,
      { programFilter: { codes: new Set(), pools: [{ discipline: "ADM" }] } },
      { minTermVolume: 50 },
    );
    expect(board.map((c) => c.code)).toEqual([normalizeCourseCode("ADM 1100")]);
  });

  it("intersects discipline and level filters", () => {
    const board = computeCourseLeaderboard(grades, { discipline: "PSY", level: 2000 });
    expect(board.map((c) => c.code)).toEqual([normalizeCourseCode("PSY 2301")]);
  });
});

describe("availableDisciplines", () => {
  it("lists disciplines by total counted volume desc", () => {
    const list = availableDisciplines(grades);
    expect(list.map((d) => d.discipline)).toEqual(["PSY", "ADM"]);
    // PSY: 100 + 50 + 50 + 80 = 280; ADM: 60 + 90 = 150
    expect(list[0]).toEqual({ discipline: "PSY", volume: 280 });
    expect(list[1]).toEqual({ discipline: "ADM", volume: 150 });
  });
});
