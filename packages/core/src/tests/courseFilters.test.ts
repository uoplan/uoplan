import { describe, it, expect } from "vitest";
import {
  isGraduateCourse,
  getCourseLevelBucket,
  getCourseLanguageBucket,
  courseMatchesFilters,
} from "../courseFilters";

describe("isGraduateCourse", () => {
  it("treats 5000+ catalogue numbers as graduate", () => {
    expect(isGraduateCourse("CSI 5100")).toBe(true);
    expect(isGraduateCourse("MAT 4999")).toBe(false);
    expect(isGraduateCourse("CSI 2110")).toBe(false);
  });

  it("returns false when there is no numeric part", () => {
    expect(isGraduateCourse("SEMINAR")).toBe(false);
    expect(isGraduateCourse("AB 123")).toBe(false); // only 3 digits
  });
});

describe("getCourseLevelBucket", () => {
  it("buckets undergrad vs grad on the 5000 boundary", () => {
    expect(getCourseLevelBucket("CSI 2110")).toBe("undergrad");
    expect(getCourseLevelBucket("CSI 4999")).toBe("undergrad");
    expect(getCourseLevelBucket("CSI 5000")).toBe("grad");
  });

  it("returns null without a 4–5 digit number", () => {
    expect(getCourseLevelBucket("CSI ???")).toBeNull();
  });
});

describe("getCourseLanguageBucket", () => {
  it("derives language from the second digit (1–4 en, 5–8 fr, else other)", () => {
    expect(getCourseLanguageBucket("CSI 2110")).toBe("en"); // 2[1]10
    expect(getCourseLanguageBucket("CSI 2410")).toBe("en");
    expect(getCourseLanguageBucket("CSI 2510")).toBe("fr");
    expect(getCourseLanguageBucket("CSI 2810")).toBe("fr");
    expect(getCourseLanguageBucket("CSI 2010")).toBe("other"); // second digit 0
    expect(getCourseLanguageBucket("CSI 2910")).toBe("other"); // second digit 9
  });

  it("returns null without a numeric part", () => {
    expect(getCourseLanguageBucket("SEMINAR")).toBeNull();
  });
});

describe("courseMatchesFilters", () => {
  const all = {
    levels: ["undergrad", "grad"] as const,
    languageBuckets: ["en", "fr", "other"] as const,
  };

  it("passes a course matching both level and language filters", () => {
    expect(
      courseMatchesFilters("CSI 2110", { levels: ["undergrad"], languageBuckets: ["en"] }),
    ).toBe(true);
  });

  it("rejects a course whose level bucket is filtered out", () => {
    expect(
      courseMatchesFilters("CSI 5100", {
        levels: ["undergrad"],
        languageBuckets: [...all.languageBuckets],
      }),
    ).toBe(false);
  });

  it("rejects a course whose language bucket is filtered out", () => {
    expect(
      courseMatchesFilters("CSI 2510", { levels: [...all.levels], languageBuckets: ["en"] }),
    ).toBe(false);
  });

  it("passes codes with no derivable bucket regardless of filters", () => {
    // no numeric part -> both buckets null -> not excluded
    expect(courseMatchesFilters("SEMINAR", { levels: [], languageBuckets: [] })).toBe(true);
  });
});
