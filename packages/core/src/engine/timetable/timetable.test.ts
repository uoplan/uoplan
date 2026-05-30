import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../seededRandom";
import {
  ConstraintPipeline,
  overlapConstraint,
  timeWindowConstraint,
  type ConstraintContext,
} from "../constraints";
import {
  buildFixtureCache,
  makeSchedule,
  makeSection,
  DEFAULT_CONSTRAINTS,
} from "../../generation/tests/golden/fixtures";
import { buildDataCache } from "../../dataCache";
import type { Catalogue, SchedulesData } from "../../dataTypes";
import { buildTimetableCourse, lazyCourseCombos } from "./lazyCombos";
import { arrangementFingerprint, enumerateArrangements } from "./enumerator";

const cache = buildFixtureCache();
const ctx: ConstraintContext = { cache, completed: new Set(), prereqEligible: new Set() };

function pipeline(extra = DEFAULT_CONSTRAINTS) {
  return new ConstraintPipeline([overlapConstraint, timeWindowConstraint(extra)]);
}

describe("lazyCourseCombos", () => {
  it("yields one empty combo for honours projects", () => {
    const p = pipeline();
    const rng = createSeededRng(1);
    const combos = [...lazyCourseCombos("CSI 4900", cache, p, ctx, rng)];
    expect(combos).toHaveLength(1);
    expect(combos[0].enrollment.times).toHaveLength(0);
  });

  it("returns null when a course has no schedule row", () => {
    const p = pipeline();
    const rng = createSeededRng(1);
    expect(buildTimetableCourse("ZZZ 9999", cache, p, ctx, rng)).toBeNull();
  });

  it("filters sections by the time-window constraint", () => {
    // CSI 2110 LEC A meets 600-690; B meets 900-990. Restrict to >= 13:00.
    const p = pipeline({ ...DEFAULT_CONSTRAINTS, minStartMinutes: 780 });
    const rng = createSeededRng(1);
    const tc = buildTimetableCourse("CSI 2110", cache, p, ctx, rng);
    expect(tc).not.toBeNull();
    // Only section B (900-990) survives.
    for (const c of tc!.combos) {
      expect(c.enrollment.times.every((t) => t.startMinutes >= 780)).toBe(true);
    }
  });
});

describe("enumerateArrangements", () => {
  it("yields MULTIPLE distinct arrangements for the same course set (the bug fix)", () => {
    // Two single-LEC courses each with two non-conflicting section options =>
    // 2 x 2 = 4 distinct timetable arrangements.
    const catalogue: Catalogue = {
      courses: [
        { code: "AAA 1000", title: "A", credits: 3, description: "" },
        { code: "BBB 1000", title: "B", credits: 3, description: "" },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "0",
      schedules: [
        makeSchedule("AAA 1000", {
          LEC: [
            makeSection("LEC", "A", [{ day: "Mo", start: 600, end: 690 }]),
            makeSection("LEC", "B", [{ day: "Mo", start: 720, end: 810 }]),
          ],
        }),
        makeSchedule("BBB 1000", {
          LEC: [
            makeSection("LEC", "A", [{ day: "Tu", start: 600, end: 690 }]),
            makeSection("LEC", "B", [{ day: "Tu", start: 720, end: 810 }]),
          ],
        }),
      ],
    };
    const c = buildDataCache(catalogue, schedules);
    const localCtx: ConstraintContext = {
      cache: c,
      completed: new Set(),
      prereqEligible: new Set(),
    };
    const p = new ConstraintPipeline([overlapConstraint]);
    const rng = createSeededRng(42);
    const courses = [
      buildTimetableCourse("AAA 1000", c, p, localCtx, rng)!,
      buildTimetableCourse("BBB 1000", c, p, localCtx, rng)!,
    ];

    const arrangements = [...enumerateArrangements(courses, p, localCtx)];
    const fingerprints = new Set(arrangements.map(arrangementFingerprint));
    expect(arrangements).toHaveLength(4);
    expect(fingerprints.size).toBe(4);
  });

  it("excludes arrangements that violate inter-course overlap", () => {
    // Both courses' only section meets Mo 600-690 => always conflict => none.
    const catalogue: Catalogue = {
      courses: [
        { code: "AAA 1000", title: "A", credits: 3, description: "" },
        { code: "BBB 1000", title: "B", credits: 3, description: "" },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "0",
      schedules: [
        makeSchedule("AAA 1000", {
          LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 600, end: 690 }])],
        }),
        makeSchedule("BBB 1000", {
          LEC: [makeSection("LEC", "A", [{ day: "Mo", start: 660, end: 750 }])],
        }),
      ],
    };
    const c = buildDataCache(catalogue, schedules);
    const localCtx: ConstraintContext = {
      cache: c,
      completed: new Set(),
      prereqEligible: new Set(),
    };
    const p = new ConstraintPipeline([overlapConstraint]);
    const rng = createSeededRng(1);
    const courses = [
      buildTimetableCourse("AAA 1000", c, p, localCtx, rng)!,
      buildTimetableCourse("BBB 1000", c, p, localCtx, rng)!,
    ];
    expect([...enumerateArrangements(courses, p, localCtx)]).toHaveLength(0);
  });

  it("is exhaustive and order varies with the seed but the SET of arrangements is stable", () => {
    const catalogue: Catalogue = {
      courses: [
        { code: "AAA 1000", title: "A", credits: 3, description: "" },
        { code: "BBB 1000", title: "B", credits: 3, description: "" },
      ],
      programs: [],
    };
    const schedules: SchedulesData = {
      termId: "0",
      schedules: [
        makeSchedule("AAA 1000", {
          LEC: [
            makeSection("LEC", "A", [{ day: "Mo", start: 600, end: 690 }]),
            makeSection("LEC", "B", [{ day: "Mo", start: 720, end: 810 }]),
            makeSection("LEC", "C", [{ day: "Mo", start: 900, end: 990 }]),
          ],
        }),
        makeSchedule("BBB 1000", {
          LEC: [
            makeSection("LEC", "A", [{ day: "Tu", start: 600, end: 690 }]),
            makeSection("LEC", "B", [{ day: "Tu", start: 720, end: 810 }]),
          ],
        }),
      ],
    };
    const c = buildDataCache(catalogue, schedules);
    const localCtx: ConstraintContext = {
      cache: c,
      completed: new Set(),
      prereqEligible: new Set(),
    };
    const p = new ConstraintPipeline([overlapConstraint]);

    function setFor(seed: number): string[] {
      const rng = createSeededRng(seed);
      const courses = [
        buildTimetableCourse("AAA 1000", c, p, localCtx, rng)!,
        buildTimetableCourse("BBB 1000", c, p, localCtx, rng)!,
      ];
      return [...enumerateArrangements(courses, p, localCtx)].map(arrangementFingerprint);
    }

    const s1 = setFor(1);
    const s2 = setFor(2);
    expect(s1).toHaveLength(6); // 3 x 2
    expect(new Set(s1)).toEqual(new Set(s2)); // same set, regardless of order
  });
});
