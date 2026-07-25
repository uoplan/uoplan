import { describe, expect, it } from "vitest";
import { getSchool } from "@uoplan/domain/school";
import { optimizationPrioritySupported } from "./optimizationPriorityFeatures";

describe("optimizationPrioritySupported", () => {
  const uottawa = getSchool("uottawa").features;
  const carleton = getSchool("carleton").features;

  it("supports every goal at a school with grades and feedback", () => {
    for (const kind of [
      "free_days",
      "good_breaks",
      "prefer_easier",
      "prefer_sentiment",
      "prefer_professor_rating",
    ] as const) {
      expect(optimizationPrioritySupported(kind, uottawa)).toBe(true);
    }
  });

  it("hides the grade- and feedback-backed goals at a school without that data", () => {
    expect(optimizationPrioritySupported("prefer_easier", carleton)).toBe(false);
    expect(optimizationPrioritySupported("prefer_sentiment", carleton)).toBe(false);
  });

  it("keeps the goals that need no registrar data", () => {
    expect(optimizationPrioritySupported("free_days", carleton)).toBe(true);
    expect(optimizationPrioritySupported("good_breaks", carleton)).toBe(true);
    expect(optimizationPrioritySupported("prefer_professor_rating", carleton)).toBe(true);
  });
});
