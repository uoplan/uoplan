import { describe, expect, it } from "vitest";
import {
  analyzeFrenchImmersionProgress,
  completedCoursesIncludeFls3500,
  countsTowardFrenchImmersionBeforeCompanionCaps,
  FLS_IMMERSION_CERT_CODE,
  frenchImmersionBalancedObjective,
  frenchImmersionExcludedByFifthDigit,
  frenchImmersionHeuristicPickWeight,
  frenchImmersionMarginalObjectiveDelta,
  frenchImmersionOverallVolumePercent,
  groupCountedFrenchImmersionCodesByCategory,
} from "../frenchImmersionDiploma";

describe("frenchImmersionExcludedByFifthDigit", () => {
  it("returns false for 4-digit codes", () => {
    expect(frenchImmersionExcludedByFifthDigit("CSI 3525")).toBe(false);
  });

  it("returns true when 5th digit is 0 or 9", () => {
    expect(frenchImmersionExcludedByFifthDigit("CSI 15109")).toBe(true);
    expect(frenchImmersionExcludedByFifthDigit("MAT 12010")).toBe(true);
  });
});

describe("countsTowardFrenchImmersionBeforeCompanionCaps", () => {
  it("excludes FLS 3500", () => {
    expect(countsTowardFrenchImmersionBeforeCompanionCaps(FLS_IMMERSION_CERT_CODE)).toBe(false);
  });

  it("requires French instruction digit (5–8)", () => {
    expect(countsTowardFrenchImmersionBeforeCompanionCaps("MAT 1320")).toBe(false);
    expect(countsTowardFrenchImmersionBeforeCompanionCaps("MAT 1520")).toBe(true);
  });

  it("requires FLS 2513 or higher for FLS", () => {
    expect(countsTowardFrenchImmersionBeforeCompanionCaps("FLS 2512")).toBe(false);
    expect(countsTowardFrenchImmersionBeforeCompanionCaps("FLS 2513")).toBe(true);
  });
});

describe("analyzeFrenchImmersionProgress", () => {
  it("never counts FLS 3500 toward volume", () => {
    const codes = [
      "FLS 3500",
      "MAT 1520",
      "MAT 1521",
      "MAT 1522",
      "MAT 1523",
      "MAT 1524",
      "MAT 1525",
      "MAT 1526",
      "MAT 1527",
      "MAT 1528",
      "MAT 1529",
      "MAT 1530",
      "MAT 1531",
      "MAT 1532",
      "MAT 1533",
    ];
    const p = analyzeFrenchImmersionProgress(codes, null);
    expect(p.countedTowardVolumeCodes).not.toContain(FLS_IMMERSION_CERT_CODE);
  });

  it("applies accompanying FLS caps", () => {
    const codes = [
      "FLS 2581",
      "FLS 2581",
      "FLS 2581",
      "FLS 3581",
      "MAT 1520",
      "MAT 1521",
      "MAT 1522",
      "MAT 1523",
      "MAT 1524",
      "MAT 1525",
      "MAT 1526",
      "MAT 1527",
      "MAT 1528",
      "MAT 1529",
      "MAT 1530",
    ];
    const p = analyzeFrenchImmersionProgress(codes, null);
    expect(p.excludedCompanionCodes.length).toBeGreaterThan(0);
    expect(p.allAccompanyingFlsCountTowardVolume).toBe(false);
  });

  it("uses 12-course target for nursing", () => {
    const codes = Array.from({ length: 11 }, (_, i) => `MAT ${1520 + i}`);
    const p = analyzeFrenchImmersionProgress(codes, null, { isNursingProgram: true });
    expect(p.requiredCourses).toBe(12);
    expect(p.volumeMet).toBe(false);
  });
});

describe("completedCoursesIncludeFls3500", () => {
  it("detects normalized FLS 3500", () => {
    expect(completedCoursesIncludeFls3500(["fls 3500"])).toBe(true);
    expect(completedCoursesIncludeFls3500(["MAT 1320"])).toBe(false);
  });
});

describe("groupCountedFrenchImmersionCodesByCategory", () => {
  it("splits non-FLS levels, accompanying FLS, and other", () => {
    const g = groupCountedFrenchImmersionCodesByCategory([
      "MAT 1520",
      "CSI 3120",
      "FLS 3581",
      "FLS 2513",
    ]);
    expect(g.level_1000_non_fls).toContain("MAT 1520");
    expect(g.level_3000_4000_non_fls).toContain("CSI 3120");
    expect(g.accompanying_fls).toContain("FLS 3581");
    expect(g.other_french).toContain("FLS 2513");
  });
});

describe("frenchImmersionBalancedObjective", () => {
  it("is in 0..1 for partial progress", () => {
    const codes = Array.from({ length: 7 }, (_, i) => `MAT ${1520 + i}`);
    const p = analyzeFrenchImmersionProgress(codes, null);
    const o = frenchImmersionBalancedObjective(p);
    expect(o).toBeGreaterThanOrEqual(0);
    expect(o).toBeLessThanOrEqual(1);
  });
});

describe("frenchImmersionHeuristicPickWeight", () => {
  it("returns 1 for courses that do not count toward immersion", () => {
    const p = analyzeFrenchImmersionProgress([], null);
    expect(frenchImmersionHeuristicPickWeight(p, "MAT 1320", null)).toBe(1);
  });

  it("is greater than 1 for French-taught counting courses when volume unmet", () => {
    const p = analyzeFrenchImmersionProgress([], null);
    expect(frenchImmersionHeuristicPickWeight(p, "MAT 1520", null)).toBeGreaterThan(1);
  });
});

describe("frenchImmersionMarginalObjectiveDelta", () => {
  it("is non-negative when adding a French-taught course that counts", () => {
    const base = Array.from({ length: 6 }, (_, i) => `MAT ${1520 + i}`);
    const d = frenchImmersionMarginalObjectiveDelta(base, "MAT 1526", null);
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it("is zero when adding a duplicate code already in the base set", () => {
    const base = ["MAT 1520", "MAT 1521"];
    expect(frenchImmersionMarginalObjectiveDelta(base, "MAT 1520", null)).toBe(0);
  });
});

describe("frenchImmersionOverallVolumePercent", () => {
  it("uses the bottleneck of course fill vs unit fill", () => {
    const p = analyzeFrenchImmersionProgress(
      Array.from({ length: 10 }, (_, i) => `MAT ${1520 + i}`),
      null,
    );
    const pct = frenchImmersionOverallVolumePercent(p);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});
