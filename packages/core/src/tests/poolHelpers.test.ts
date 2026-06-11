import { describe, expect, it } from "vitest";
import {
  buildPoolCaps,
  buildRequirementPools,
  candidatePoolWeight,
  computeCoursesPerPool,
  courseLevelSortKey,
  enumerateSingleRedistributions,
  isBroadElectivePoolType,
  isElectiveRequirementType,
  isWithinElectiveLevelBuckets,
  isWithinElectiveLevelCap,
  LEVEL_WEIGHT_BASE,
  poolCourseCap,
  shuffleInPlace,
  virtualScheduleFilterApplies,
  weightedRandomPick,
} from "../poolHelpers";
import type { RequirementPool } from "../poolHelpers";
import type { RemainingRequirement } from "../requirements";
import type { DataCache } from "../dataCache";

const dummyCache = {} as DataCache;

function req(partial: Partial<RemainingRequirement>): RemainingRequirement {
  return {
    requirementId: "r1",
    type: "course",
    candidateCourses: ["CSI 1234"],
    creditsNeeded: 3,
    satisfiedBy: [],
    ...partial,
  };
}

function pool(partial: Partial<RequirementPool>): RequirementPool {
  return {
    requirementId: "p",
    type: "elective",
    label: "Elective",
    candidateCourses: [],
    creditsNeeded: 3,
    minCourses: 0,
    ...partial,
  };
}

describe("buildRequirementPools", () => {
  it("builds a pool per valid requirement and dedupes candidates", () => {
    const pools = buildRequirementPools([
      req({
        requirementId: "r1",
        type: "course",
        title: "Intro",
        candidateCourses: ["CSI 1234", "CSI 1234", "MAT 1320"],
        creditsNeeded: 3,
      }),
    ]);
    expect(pools).toHaveLength(1);
    expect(pools[0].candidateCourses).toEqual(["CSI 1234", "MAT 1320"]);
    expect(pools[0].label).toBe("Intro");
    expect(pools[0].minCourses).toBe(1); // "course" => 1
  });

  it("falls back to type then 'Requirement' for the label", () => {
    expect(buildRequirementPools([req({ title: undefined, type: "elective" })])[0].label).toBe(
      "elective",
    );
  });

  it("skips requirements without an id, without candidates, or with no credits", () => {
    const pools = buildRequirementPools([
      req({ requirementId: "" }),
      req({ requirementId: "r2", candidateCourses: [] }),
      req({ requirementId: "r3", creditsNeeded: 0 }),
      req({ requirementId: "r4", creditsNeeded: undefined }),
    ]);
    expect(pools).toHaveLength(0);
  });

  it("only assigns minCourses=1 to course / or_course types", () => {
    expect(buildRequirementPools([req({ type: "or_course" })])[0].minCourses).toBe(1);
    expect(buildRequirementPools([req({ type: "elective" })])[0].minCourses).toBe(0);
  });
});

describe("elective type predicates", () => {
  it("classifies broad elective pool types", () => {
    for (const t of ["elective", "free_elective", "non_discipline_elective", "faculty_elective"]) {
      expect(isBroadElectivePoolType(t)).toBe(true);
    }
    expect(isBroadElectivePoolType("discipline_elective")).toBe(false);
    expect(isBroadElectivePoolType("course")).toBe(false);
    expect(isBroadElectivePoolType()).toBe(false);
  });

  it("classifies elective requirement types (includes discipline_elective)", () => {
    expect(isElectiveRequirementType("discipline_elective")).toBe(true);
    expect(isElectiveRequirementType("free_elective")).toBe(true);
    expect(isElectiveRequirementType("course")).toBe(false);
  });
});

describe("elective level caps and buckets", () => {
  it("caps electives at 4000-level (unknown levels pass)", () => {
    expect(isWithinElectiveLevelCap("CSI 4900")).toBe(true);
    expect(isWithinElectiveLevelCap("CSI 5900")).toBe(false);
    expect(isWithinElectiveLevelCap("SEMINAR")).toBe(true); // unknown level
  });

  it("falls back to the cap when no buckets are provided", () => {
    expect(isWithinElectiveLevelBuckets("CSI 5900", [])).toBe(false);
    expect(isWithinElectiveLevelBuckets("CSI 3900", [])).toBe(true);
  });

  it("matches the floored thousand bucket when buckets are provided", () => {
    expect(isWithinElectiveLevelBuckets("CSI 3540", [3000])).toBe(true);
    expect(isWithinElectiveLevelBuckets("CSI 3540", [1000, 2000])).toBe(false);
    expect(isWithinElectiveLevelBuckets("UNKNOWN", [1000])).toBe(true); // unknown level passes
  });
});

describe("virtualScheduleFilterApplies", () => {
  const exempt = new Set<string>();
  it("only applies to broad elective pools when virtual-only is on", () => {
    expect(virtualScheduleFilterApplies(true, "elective", "CSI 1234", exempt)).toBe(true);
    expect(virtualScheduleFilterApplies(false, "elective", "CSI 1234", exempt)).toBe(false);
    expect(virtualScheduleFilterApplies(true, "course", "CSI 1234", exempt)).toBe(false);
  });

  it("exempts explicitly normalized courses", () => {
    const ex = new Set(["CSI 1234"]);
    expect(virtualScheduleFilterApplies(true, "elective", "CSI 1234", ex)).toBe(false);
  });
});

describe("poolCourseCap / buildPoolCaps", () => {
  it("caps at ceil(credits/3) but never below minCourses", () => {
    expect(poolCourseCap(pool({ creditsNeeded: 9, minCourses: 0 }))).toBe(3);
    expect(poolCourseCap(pool({ creditsNeeded: 4, minCourses: 0 }))).toBe(2); // ceil(4/3)
    expect(poolCourseCap(pool({ creditsNeeded: 3, minCourses: 2 }))).toBe(2); // minCourses dominates
  });

  it("caps discipline_elective pools at 1 course", () => {
    expect(poolCourseCap(pool({ type: "discipline_elective", creditsNeeded: 9 }))).toBe(1);
  });

  it("builds a map keyed by requirementId", () => {
    const caps = buildPoolCaps([
      pool({ requirementId: "a", creditsNeeded: 6 }),
      pool({ requirementId: "b", creditsNeeded: 3 }),
    ]);
    expect(caps.get("a")).toBe(2);
    expect(caps.get("b")).toBe(1);
  });
});

describe("computeCoursesPerPool", () => {
  it("returns empty when there are no slots or pools", () => {
    expect(computeCoursesPerPool([], 5, dummyCache).size).toBe(0);
    expect(computeCoursesPerPool([pool({})], 0, dummyCache).size).toBe(0);
  });

  it("fills structured pools before broad electives", () => {
    const structured = pool({
      requirementId: "s",
      type: "course",
      creditsNeeded: 3,
      minCourses: 1,
    });
    const broad = pool({ requirementId: "e", type: "elective", creditsNeeded: 9 });
    const result = computeCoursesPerPool([structured, broad], 1, dummyCache);
    expect(result.get("s")).toBe(1);
    expect(result.get("e")).toBe(0);
  });

  it("never exceeds the total available slots and respects caps", () => {
    const a = pool({ requirementId: "a", type: "course", creditsNeeded: 3, minCourses: 1 }); // cap 1
    const b = pool({ requirementId: "b", type: "elective", creditsNeeded: 6 }); // cap 2
    const result = computeCoursesPerPool([a, b], 10, dummyCache);
    const total = [...result.values()].reduce((s, n) => s + n, 0);
    // capacity is 1 + 2 = 3, but overflow into broad pools is allowed up to slots
    expect(result.get("a")).toBe(1);
    expect(total).toBeLessThanOrEqual(10);
    expect(total).toBeGreaterThanOrEqual(3);
  });
});

describe("enumerateSingleRedistributions", () => {
  it("moves one course from a structured pool into a broad pool with room", () => {
    const structured = pool({ requirementId: "s", type: "course" });
    const broad = pool({ requirementId: "e", type: "elective" });
    const current = new Map([
      ["s", 1],
      ["e", 0],
    ]);
    const cap = new Map([
      ["s", 1],
      ["e", 2],
    ]);
    const out = enumerateSingleRedistributions(current, [structured, broad], cap);
    expect(out).toHaveLength(1);
    expect(out[0].get("s")).toBe(0);
    expect(out[0].get("e")).toBe(1);
  });

  it("produces nothing when broad pools are already at capacity", () => {
    const structured = pool({ requirementId: "s", type: "course" });
    const broad = pool({ requirementId: "e", type: "elective" });
    const current = new Map([
      ["s", 1],
      ["e", 2],
    ]);
    const cap = new Map([
      ["s", 1],
      ["e", 2],
    ]);
    expect(enumerateSingleRedistributions(current, [structured, broad], cap)).toHaveLength(0);
  });
});

describe("shuffleInPlace", () => {
  it("is a permutation that mutates the array in place", () => {
    const arr = [1, 2, 3, 4, 5];
    const rng = () => 0; // deterministic
    shuffleInPlace(arr, rng);
    expect([...arr].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("with rng=0 rotates elements deterministically", () => {
    const arr = ["a", "b", "c"];
    shuffleInPlace(arr, () => 0);
    // Fisher-Yates with j=0 each step swaps arr[i] with arr[0]
    expect(arr).toEqual(["b", "c", "a"]);
  });
});

describe("weightedRandomPick", () => {
  it("selects the item whose cumulative weight contains the draw", () => {
    const items = ["a", "b", "c"];
    const weights = [1, 1, 2]; // total 4
    expect(weightedRandomPick(items, weights, () => 0)).toBe("a"); // r=0 -> a
    expect(weightedRandomPick(items, weights, () => 0.25 + 0.001)).toBe("b");
    expect(weightedRandomPick(items, weights, () => 0.9)).toBe("c");
  });

  it("returns the last item when the draw lands at the top of the range", () => {
    expect(weightedRandomPick(["x", "y"], [1, 1], () => 0.999999)).toBe("y");
  });
});

describe("courseLevelSortKey / candidatePoolWeight", () => {
  it("returns the floored thousand-level or a large sentinel for unknown levels", () => {
    expect(courseLevelSortKey("CSI 2110")).toBe(2000);
    expect(courseLevelSortKey("SEMINAR")).toBe(999_000);
  });

  it("halves the weight per thousand-level tier", () => {
    expect(candidatePoolWeight(1000, false)).toBeCloseTo(1);
    expect(candidatePoolWeight(2000, false)).toBeCloseTo(1 / LEVEL_WEIGHT_BASE);
    expect(candidatePoolWeight(3000, false)).toBeCloseTo(1 / LEVEL_WEIGHT_BASE ** 2);
  });

  it("penalizes courses with non-course prerequisites", () => {
    expect(candidatePoolWeight(1000, true)).toBeCloseTo(0.3);
  });

  it("floors unknown-level courses to a tiny weight", () => {
    expect(candidatePoolWeight(999_000, false)).toBeCloseTo(0.01);
  });
});
