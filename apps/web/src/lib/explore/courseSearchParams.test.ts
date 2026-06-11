import { describe, expect, it } from "vitest";
import { courseNormToPathParam, parseCoursePathParam } from "./courseSearchParams";
import { testCourseCode } from "../../test/brands";

describe("courseNormToPathParam", () => {
  it("encodes normalized code as compact lowercase", () => {
    expect(courseNormToPathParam(testCourseCode("CSI 2110"))).toBe("csi2110");
    expect(courseNormToPathParam(testCourseCode("MAT 1341"))).toBe("mat1341");
  });

  it("preserves letter suffix", () => {
    expect(courseNormToPathParam(testCourseCode("MAT 1341A"))).toBe("mat1341a");
  });
});

describe("parseCoursePathParam", () => {
  it("parses lowercase path segments", () => {
    expect(parseCoursePathParam("csi2110")).toBe("CSI 2110");
    expect(parseCoursePathParam("mat1341")).toBe("MAT 1341");
  });

  it("parses uppercase path segments", () => {
    expect(parseCoursePathParam("CSI2110")).toBe("CSI 2110");
  });

  it("parses letter suffix codes", () => {
    expect(parseCoursePathParam("mat1341a")).toBe("MAT 1341A");
  });

  it("returns null for invalid input", () => {
    expect(parseCoursePathParam()).toBeNull();
    expect(parseCoursePathParam("")).toBeNull();
    expect(parseCoursePathParam("invalid")).toBeNull();
    expect(parseCoursePathParam("CS2110")).toBeNull();
  });
});
