import { describe, expect, it } from "vitest";
import { computeCoursesPerPool, type RequirementPool } from "./scheduleHelpers";

const cache = {} as import("schedule").DataCache;

function pool(
  id: string,
  creditsNeeded: number,
  overrides?: Partial<RequirementPool>,
): RequirementPool {
  return {
    requirementId: id,
    type: "elective",
    label: id,
    candidateCourses: [],
    creditsNeeded,
    minCourses: 0,
    ...overrides,
  };
}

describe("computeCoursesPerPool", () => {
  it("allocates exactly remainingCourseSlots when caps sum higher than slots", () => {
    const pools = [pool("a", 3), pool("b", 3), pool("c", 12)];
    const m = computeCoursesPerPool(pools, 5, cache);
    const sum = [...m.values()].reduce((s, n) => s + n, 0);
    expect(sum).toBe(5);
  });

  it("never exceeds sum of per-pool caps when semester slots ask for more", () => {
    const pools = [pool("a", 3), pool("b", 3), pool("c", 6)];
    const m = computeCoursesPerPool(pools, 5, cache);
    const sum = [...m.values()].reduce((s, n) => s + n, 0);
    expect(sum).toBe(4);
    expect(m.get("c")).toBe(2);
  });

  it("matches strict caps when semester count equals sum of caps", () => {
    const pools = [pool("a", 3), pool("b", 3), pool("c", 6)];
    const m = computeCoursesPerPool(pools, 4, cache);
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).toBe(1);
    expect(m.get("c")).toBe(2);
  });
});
