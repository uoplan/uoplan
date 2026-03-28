import { describe, it, expect } from "vitest";
import {
  mergeGlobalExplicitRule,
  pickFromUserAndGeneralPools,
  splitRequiredAndGeneral,
} from "../scheduleCandidates/explicitPoolPicks";
import {
  computeKUserKGeneral,
  shouldPinAllExplicit,
  shouldUseExplicitOnlyPool,
} from "../scheduleCandidates/kUserKGeneral";

describe("computeKUserKGeneral", () => {
  it("matches min(need, S) with remainder from general", () => {
    expect(computeKUserKGeneral(3, 5)).toEqual({ kUser: 3, kGeneral: 0 });
    expect(computeKUserKGeneral(5, 3)).toEqual({ kUser: 3, kGeneral: 2 });
    expect(computeKUserKGeneral(4, 4)).toEqual({ kUser: 4, kGeneral: 0 });
    expect(computeKUserKGeneral(0, 3)).toEqual({ kUser: 0, kGeneral: 0 });
  });
});

describe("shouldPinAllExplicit", () => {
  it("pins every explicit course when union is smaller than non-honours target", () => {
    expect(shouldPinAllExplicit(2, 5)).toBe(true);
    expect(shouldPinAllExplicit(1, 3)).toBe(true);
  });

  it("does not pin when empty or enough explicit to fill alone", () => {
    expect(shouldPinAllExplicit(0, 5)).toBe(false);
    expect(shouldPinAllExplicit(5, 5)).toBe(false);
    expect(shouldPinAllExplicit(6, 5)).toBe(false);
  });
});

describe("splitRequiredAndGeneral", () => {
  it("delegates to the unified min rule", () => {
    expect(splitRequiredAndGeneral(5, 3)).toEqual(computeKUserKGeneral(5, 3));
  });
});

describe("mergeGlobalExplicitRule", () => {
  it("combines pin-all and explicit-only flags", () => {
    expect(mergeGlobalExplicitRule(2, 5)).toEqual({
      pinAllExplicit: true,
      explicitOnly: false,
    });
    expect(mergeGlobalExplicitRule(6, 5)).toEqual({
      pinAllExplicit: false,
      explicitOnly: true,
    });
    expect(mergeGlobalExplicitRule(5, 5)).toEqual({
      pinAllExplicit: false,
      explicitOnly: true,
    });
  });
});

describe("pickFromUserAndGeneralPools", () => {
  it("slices shuffled user and general lists", () => {
    const r = pickFromUserAndGeneralPools({
      need: 3,
      sAvailOrdered: ["A", "B", "C", "D"],
      gAvailOrdered: ["X", "Y", "Z"],
    });
    expect(r.userPicks).toEqual(["A", "B", "C"]);
    expect(r.generalPicks).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("fails when general pool is too small", () => {
    const r = pickFromUserAndGeneralPools({
      need: 4,
      sAvailOrdered: ["A"],
      gAvailOrdered: ["X", "Y"],
    });
    expect(r.userPicks).toEqual(["A"]);
    expect(r.generalPicks).toEqual(["X", "Y"]);
    expect(r.ok).toBe(false);
  });
});

describe("shouldUseExplicitOnlyPool", () => {
  it("restricts general pool to explicit union when it can fill the term", () => {
    expect(shouldUseExplicitOnlyPool(5, 5)).toBe(true);
    expect(shouldUseExplicitOnlyPool(10, 4)).toBe(true);
  });

  it("is false when not enough explicit courses", () => {
    expect(shouldUseExplicitOnlyPool(3, 5)).toBe(false);
    expect(shouldUseExplicitOnlyPool(0, 5)).toBe(false);
  });

  it("is false when effective target is zero", () => {
    expect(shouldUseExplicitOnlyPool(5, 0)).toBe(false);
  });
});
