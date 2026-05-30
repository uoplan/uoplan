import { describe, expect, it } from "vitest";
import { COURSE_COLORS, buildColorMap, transferSwapColor } from "../utils/uiUtils";
import type { GeneratedSchedule } from "../generation/types";

function scheduleFromCodes(codes: string[]): GeneratedSchedule {
  return {
    enrollments: codes.map(
      (courseCode) =>
        ({ courseCode, sections: [] }) as unknown as GeneratedSchedule["enrollments"][number],
    ),
  };
}

describe("buildColorMap", () => {
  it("assigns colours by alphabetical course-code order", () => {
    const map = buildColorMap(scheduleFromCodes(["CSI2110", "ADM1100", "BIO1130"]));
    expect(map).toEqual({ ADM1100: 0, BIO1130: 1, CSI2110: 2 });
  });

  it("de-duplicates course codes (multi-component courses share one colour)", () => {
    const map = buildColorMap(scheduleFromCodes(["MAT1320", "MAT1320", "PHY1124"]));
    expect(map).toEqual({ MAT1320: 0, PHY1124: 1 });
  });

  it("wraps colour indices modulo the palette length", () => {
    const codes = Array.from(
      { length: COURSE_COLORS.length + 2 },
      (_, i) => `C${String(i).padStart(3, "0")}`,
    );
    const map = buildColorMap(scheduleFromCodes(codes));
    expect(map[codes[COURSE_COLORS.length]]).toBe(0);
    expect(map[codes[COURSE_COLORS.length + 1]]).toBe(1);
  });
});

describe("transferSwapColor (swap colour inheritance)", () => {
  it("makes the swapped-in course inherit the old course's colour and drops the old code", () => {
    const base = { ADM1100: 0, BIO1130: 1, CSI2110: 2 };
    expect(transferSwapColor(base, "BIO1130", "CHM1311")).toEqual({
      ADM1100: 0,
      CHM1311: 1,
      CSI2110: 2,
    });
  });

  it("preserves colour identity across multiple swaps on the same slot", () => {
    let map = buildColorMap(scheduleFromCodes(["ADM1100", "BIO1130", "CSI2110"]));
    map = transferSwapColor(map, "BIO1130", "CHM1311");
    map = transferSwapColor(map, "CHM1311", "PHY1124");
    // Colour 1 (originally BIO1130's) follows the slot through both swaps.
    expect(map).toEqual({ ADM1100: 0, PHY1124: 1, CSI2110: 2 });
  });

  it("does NOT re-sort colours after a swap (the OG-image divergence bug)", () => {
    // After swapping BIO1130 -> ZOO9999, rebuilding from scratch would re-sort
    // alphabetically and shift colours; inheritance must keep colour 1.
    const base = buildColorMap(scheduleFromCodes(["ADM1100", "BIO1130", "CSI2110"]));
    const inherited = transferSwapColor(base, "BIO1130", "ZOO9999");
    expect(inherited.ZOO9999).toBe(1);
    expect(buildColorMap(scheduleFromCodes(["ADM1100", "ZOO9999", "CSI2110"])).ZOO9999).toBe(2);
  });

  it("transfers nothing when the old code has no colour", () => {
    const base = { ADM1100: 0 };
    expect(transferSwapColor(base, "MISSING", "NEW1000")).toEqual({ ADM1100: 0 });
  });

  it("overwrites when swapping to a course code already present (mirrors web behaviour)", () => {
    const base = { ADM1100: 0, BIO1130: 1, CSI2110: 2 };
    // Swap CSI2110 (colour 2) into the already-present BIO1130 code.
    expect(transferSwapColor(base, "CSI2110", "BIO1130")).toEqual({
      ADM1100: 0,
      BIO1130: 2,
    });
  });
});
