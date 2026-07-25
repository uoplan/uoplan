import { describe, expect, it } from "vitest";

import { assertSchoolFeature } from "./schoolFeatures.ts";

describe("assertSchoolFeature", () => {
  it("allows uOttawa-only grade features for uOttawa", () => {
    expect(() =>
      assertSchoolFeature("uottawa", "grades", "Grades are uOttawa-only."),
    ).not.toThrow();
  });

  it("throws a clear actionable error for unsupported Carleton features", () => {
    expect(() =>
      assertSchoolFeature(
        "carleton",
        "grades",
        "Carleton has no public grade data; grades are uOttawa-only.",
      ),
    ).toThrow("Carleton has no public grade data; grades are uOttawa-only.");
  });
});
