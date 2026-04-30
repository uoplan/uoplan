import { describe, it, expect } from "vitest";
import {
  isGroupToken,
  groupTokenPrefix,
  makeGroupToken,
  subjectPrefix,
} from "../utils/groupToken";

describe("isGroupToken", () => {
  it("returns true for group tokens", () => {
    expect(isGroupToken("group:CSI")).toBe(true);
    expect(isGroupToken("group:MAT")).toBe(true);
  });
  it("returns false for real course codes", () => {
    expect(isGroupToken("CSI 2101")).toBe(false);
    expect(isGroupToken("MAT 1320")).toBe(false);
    expect(isGroupToken("")).toBe(false);
  });
});

describe("groupTokenPrefix", () => {
  it("extracts prefix", () => {
    expect(groupTokenPrefix("group:CSI")).toBe("CSI");
    expect(groupTokenPrefix("group:MAT")).toBe("MAT");
  });
});

describe("makeGroupToken", () => {
  it("creates token from prefix", () => {
    expect(makeGroupToken("CSI")).toBe("group:CSI");
    expect(makeGroupToken("MAT")).toBe("group:MAT");
  });
  it("round-trips with groupTokenPrefix", () => {
    expect(groupTokenPrefix(makeGroupToken("CEG"))).toBe("CEG");
  });
});

describe("subjectPrefix", () => {
  it("extracts subject from course code", () => {
    expect(subjectPrefix("CSI 2101")).toBe("CSI");
    expect(subjectPrefix("MAT 1320")).toBe("MAT");
    expect(subjectPrefix("CEG 2136")).toBe("CEG");
    expect(subjectPrefix("PHY 1122")).toBe("PHY");
  });
  it("returns empty string for empty input", () => {
    expect(subjectPrefix("")).toBe("");
  });
});
