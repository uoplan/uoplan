import { describe, it, expect } from "vitest";
import {
  COURSE_COLORS,
  getCourseColor,
  getCourseColorHex,
  getCourseColorOklch,
  buildColorMap,
  transferSwapColor,
  hexToRgb,
  ratingToColor,
  getRequirementStatusColor,
  formatCredits,
  truncateText,
} from "../utils/uiUtils";
import type { GeneratedSchedule, CourseEnrollment } from "../generation/types";
import type { NormalizedCourseCode } from "../brand";

function enrollment(code: string): CourseEnrollment {
  return { courseCode: code as NormalizedCourseCode, sectionCombo: {}, times: [] };
}

describe("course colour indexing", () => {
  it("cycles through the palette by index", () => {
    expect(getCourseColor(0)).toBe(COURSE_COLORS[0]);
    expect(getCourseColor(COURSE_COLORS.length)).toBe(COURSE_COLORS[0]);
    expect(getCourseColor(COURSE_COLORS.length + 1)).toBe(COURSE_COLORS[1]);
  });

  it("resolves hex and oklch values consistently with the index", () => {
    expect(getCourseColorHex(0)).toBe("#7950f2"); // violet
    expect(getCourseColorOklch(0)).toBe("oklch(0.5692 0.2289 288.56)");
  });
});

describe("buildColorMap", () => {
  it("assigns sorted, de-duplicated course codes stable colour indices", () => {
    const schedule: GeneratedSchedule = {
      enrollments: [enrollment("MAT 1320"), enrollment("CSI 2110"), enrollment("MAT 1320")],
    };
    expect(buildColorMap(schedule)).toEqual({ "CSI 2110": 0, "MAT 1320": 1 });
  });

  it("wraps colour indices around the palette length", () => {
    const enrollments = Array.from({ length: COURSE_COLORS.length + 1 }, (_, i) =>
      enrollment(`AAA ${1000 + i}`),
    );
    const map = buildColorMap({ enrollments });
    expect(map[`AAA ${1000 + COURSE_COLORS.length}`]).toBe(0);
  });
});

describe("transferSwapColor", () => {
  it("moves the old course's colour to the new course and drops the old key", () => {
    const result = transferSwapColor({ "CSI 2110": 3, "MAT 1320": 1 }, "CSI 2110", "CSI 3120");
    expect(result).toEqual({ "MAT 1320": 1, "CSI 3120": 3 });
  });

  it("just drops the old key when it had no colour", () => {
    const result = transferSwapColor({ "MAT 1320": 1 }, "CSI 2110", "CSI 3120");
    expect(result).toEqual({ "MAT 1320": 1 });
  });
});

describe("hexToRgb", () => {
  it("parses a 6-digit hex (with or without #)", () => {
    expect(hexToRgb("#7950f2")).toEqual({ r: 0x79, g: 0x50, b: 0xf2 });
    expect(hexToRgb("40c057")).toEqual({ r: 64, g: 192, b: 87 });
  });

  it("returns black for malformed input", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 0, g: 0, b: 0 }); // only 1 full pair
    expect(hexToRgb("zzz")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("ratingToColor", () => {
  it.each([
    [null, "gray"],
    [0, "gray"],
    [-1, "gray"],
    [2.4, "red"],
    [2.5, "orange"],
    [3.2, "orange"],
    [3.3, "yellow"],
    [3.9, "yellow"],
    [4.0, "green"],
    [5, "green"],
  ])("maps %s to %s", (rating, expected) => {
    expect(ratingToColor(rating as number)).toBe(expected);
  });
});

describe("getRequirementStatusColor", () => {
  it("maps each status to its Mantine colour", () => {
    expect(getRequirementStatusColor("complete")).toBe("green");
    expect(getRequirementStatusColor("partial")).toBe("yellow");
    expect(getRequirementStatusColor("selected")).toBe("blue");
    expect(getRequirementStatusColor("incomplete")).toBe("gray");
  });
});

describe("formatCredits", () => {
  it("uses the singular form only for exactly one credit", () => {
    expect(formatCredits(1)).toBe("1 credit");
    expect(formatCredits(3)).toBe("3 credits");
    expect(formatCredits(0)).toBe("0 credits");
  });
});

describe("truncateText", () => {
  it("leaves short text untouched", () => {
    expect(truncateText("hello", 10)).toBe("hello");
    expect(truncateText("hello", 5)).toBe("hello");
  });

  it("truncates with an ellipsis that respects the max length", () => {
    expect(truncateText("hello world", 5)).toBe("hell…");
    expect(truncateText("hello world", 5)).toHaveLength(5);
  });
});
