import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../seededRandom";
import { ConstraintPipeline, overlapConstraint, type ConstraintContext } from "../constraints";
import { buildDataCache } from "../../dataCache";
import type { Catalogue, SchedulesData } from "../../dataTypes";
import { makeSchedule, makeSection } from "../../generation/tests/golden/fixtures";
import { arrangementFingerprint } from "./enumerator";
import { enumerateSubsetTimetables, firstSubsetArrangement } from "./subsetEnumerator";

function buildCache(): ReturnType<typeof buildDataCache> {
  const catalogue: Catalogue = {
    courses: [
      { code: "PIN 1000", title: "Pinned", credits: 3, description: "" },
      { code: "OPT 1000", title: "Opt A", credits: 3, description: "" },
      { code: "OPT 2000", title: "Opt B", credits: 3, description: "" },
      { code: "OPT 3000", title: "Opt C", credits: 3, description: "" },
    ],
    programs: [],
  };
  const schedules: SchedulesData = {
    termId: "0",
    schedules: [
      makeSchedule("PIN 1000", {
        LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 600, end: 690 }])],
      }),
      makeSchedule("OPT 1000", {
        LEC: [makeSection("LEC", "A", [{ day: "Tu", start: 600, end: 690 }])],
      }),
      makeSchedule("OPT 2000", {
        LEC: [makeSection("LEC", "A", [{ day: "We", start: 600, end: 690 }])],
      }),
      makeSchedule("OPT 3000", {
        LEC: [makeSection("LEC", "A", [{ day: "Th", start: 600, end: 690 }])],
      }),
    ],
  };
  return buildDataCache(catalogue, schedules);
}

const cache = buildCache();
const ctx: ConstraintContext = { cache, completed: new Set(), prereqEligible: new Set() };
const pipeline = new ConstraintPipeline([overlapConstraint]);

function input(seed: number, optional: string[]) {
  return {
    pinned: ["PIN 1000"],
    optional,
    targetCount: 3,
    cache,
    pipeline,
    ctx,
    rng: createSeededRng(seed),
  };
}

describe("enumerateSubsetTimetables", () => {
  it("always includes every pinned course and picks exactly targetCount courses", () => {
    const schedule = firstSubsetArrangement(input(1, ["OPT 1000", "OPT 2000", "OPT 3000"]));
    expect(schedule).not.toBeNull();
    const codes = schedule!.enrollments.map((e) => e.courseCode).sort();
    expect(codes).toHaveLength(3);
    expect(codes).toContain("PIN 1000");
  });

  it("preserves the given optional order (no internal re-sort) so subset is deterministic for an order", () => {
    // targetCount-pinned = 2 optional slots. With this order, the first two
    // schedulable optionals are picked.
    const a = firstSubsetArrangement(input(1, ["OPT 1000", "OPT 2000", "OPT 3000"]));
    const setA = a!.enrollments.map((e) => e.courseCode).sort();
    expect(setA).toEqual(["OPT 1000", "OPT 2000", "PIN 1000"]);

    const b = firstSubsetArrangement(input(1, ["OPT 3000", "OPT 2000", "OPT 1000"]));
    const setB = b!.enrollments.map((e) => e.courseCode).sort();
    expect(setB).toEqual(["OPT 2000", "OPT 3000", "PIN 1000"]);
  });

  it("enumerates all distinct subset+arrangement combinations without duplicates", () => {
    // C(3,2) = 3 subsets, each a single arrangement (one section per course).
    const all = [...enumerateSubsetTimetables(input(7, ["OPT 1000", "OPT 2000", "OPT 3000"]))];
    const fps = new Set(all.map(arrangementFingerprint));
    expect(all).toHaveLength(3);
    expect(fps.size).toBe(3);
  });

  it("yields nothing when a pinned course cannot be scheduled", () => {
    const bad = {
      ...input(1, ["OPT 1000", "OPT 2000"]),
      pinned: ["DOES 9999"],
    };
    expect([...enumerateSubsetTimetables(bad)]).toHaveLength(0);
  });
});
