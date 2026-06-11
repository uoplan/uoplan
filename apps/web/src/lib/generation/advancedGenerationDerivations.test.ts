import { describe, expect, it } from "vitest";
import type { RemainingRequirement } from "@uoplan/core";

import {
  buildPoolCourseOptions,
  computeFirstYearCredits,
  countUniqueSelected,
} from "./advancedGenerationDerivations";
import type { CourseCreditsLookup } from "./advancedGenerationDerivations";

function req(candidateCourses: string[]): RemainingRequirement {
  return { candidateCourses } as RemainingRequirement;
}

function cacheWith(credits: Record<string, number>): CourseCreditsLookup {
  return {
    getCourse(code) {
      return code in credits ? { credits: credits[code] } : undefined;
    },
  };
}

describe("buildPoolCourseOptions", () => {
  it("dedupes candidates, drops completed courses, and sorts by label", () => {
    const options = buildPoolCourseOptions(
      [req(["CSI 2110", "MAT 1320"]), req(["MAT 1320", "ANP 1105"])],
      ["MAT 1320"],
    );
    expect(options).toEqual([
      { value: "ANP 1105", label: "ANP 1105" },
      { value: "CSI 2110", label: "CSI 2110" },
    ]);
  });

  it("returns an empty list when there are no candidates", () => {
    expect(buildPoolCourseOptions([], ["CSI 2110"])).toEqual([]);
  });
});

describe("countUniqueSelected", () => {
  it("counts distinct courses across requirements", () => {
    expect(countUniqueSelected({ a: ["CSI 2110", "MAT 1320"], b: ["MAT 1320", "ANP 1105"] })).toBe(
      3,
    );
  });

  it("is zero for an empty selection", () => {
    expect(countUniqueSelected({})).toBe(0);
  });
});

describe("computeFirstYearCredits", () => {
  it("sums first-year credits from completed and selected, excluding 2000+ courses", () => {
    const cache = cacheWith({ "MAT 1320": 3, "ANP 1105": 4, "CSI 2110": 3 });
    const result = computeFirstYearCredits(cache, ["MAT 1320"], { a: ["ANP 1105", "CSI 2110"] });
    // MAT 1320 (3) + ANP 1105 (4); CSI 2110 is 2000+ so excluded.
    expect(result.total).toBe(7);
    expect(result.warn).toBe(false);
  });

  it("does not double-count a selected course already completed", () => {
    const cache = cacheWith({ "MAT 1320": 3 });
    const result = computeFirstYearCredits(cache, ["MAT 1320"], { a: ["MAT 1320"] });
    expect(result.total).toBe(3);
  });

  it("falls back to 3 credits when a course is missing from the cache", () => {
    const result = computeFirstYearCredits(null, ["MAT 1320"], {});
    expect(result.total).toBe(3);
  });

  it("warns when the first-year credit total exceeds 48", () => {
    const completed = Array.from({ length: 17 }, (_, i) => `XXX 1${String(i).padStart(3, "0")}`);
    const result = computeFirstYearCredits(null, completed, {});
    expect(result.total).toBe(51);
    expect(result.warn).toBe(true);
  });
});
