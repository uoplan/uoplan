import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../seededRandom";
import { ConstraintPipeline, overlapConstraint, timeWindowConstraint } from "../constraints";
import type { ConstraintContext } from "../constraints";
import {
  buildFixtureCache,
  DEFAULT_CONSTRAINTS,
  makeSchedule,
  makeSection,
} from "../../generation/tests/golden/fixtures";
import { buildDataCache } from "../../dataCache";
import type { SchedulesData } from "../../dataTypes";
import { buildTimetableCourse, lazyCourseCombos } from "./lazyCombos";
import { arrangementFingerprint, enumerateArrangements } from "./enumerator";
import { makeRelaxationCatalogue } from "../../tests/engineTestHelpers";
import { normalizeCourseCode } from "../../utils/courseUtils";

const cache = buildFixtureCache();
const ctx: ConstraintContext = { cache, completed: new Set(), prereqEligible: new Set() };

function pipeline(extra = DEFAULT_CONSTRAINTS) {
  return new ConstraintPipeline([overlapConstraint, timeWindowConstraint(extra)]);
}

function twoCourseCache(
  aaaTimes: Parameters<typeof makeSection>[2][],
  bbbTimes: Parameters<typeof makeSection>[2][],
) {
  const schedules: SchedulesData = {
    termId: "0",
    schedules: [
      makeSchedule(normalizeCourseCode("AAA 1000"), {
        LEC: aaaTimes.map((times, index) =>
          makeSection("LEC", String.fromCharCode(65 + index), times),
        ),
      }),
      makeSchedule(normalizeCourseCode("BBB 1000"), {
        LEC: bbbTimes.map((times, index) =>
          makeSection("LEC", String.fromCharCode(65 + index), times),
        ),
      }),
    ],
  };
  return buildDataCache(makeRelaxationCatalogue(), schedules);
}

function twoNonOverlappingLectureTimes(day: "Mo" | "Tu"): Parameters<typeof makeSection>[2][] {
  return [[{ day, start: 600, end: 690 }], [{ day, start: 720, end: 810 }]];
}

function contextFor(localCache: typeof cache): ConstraintContext {
  return {
    cache: localCache,
    completed: new Set(),
    prereqEligible: new Set(),
  };
}

function timetableCourses(
  localCache: typeof cache,
  p: ConstraintPipeline,
  localCtx: ConstraintContext,
  seed: number,
) {
  const rng = createSeededRng(seed);
  return [
    buildTimetableCourse(normalizeCourseCode("AAA 1000"), localCache, p, localCtx, rng)!,
    buildTimetableCourse(normalizeCourseCode("BBB 1000"), localCache, p, localCtx, rng)!,
  ];
}

describe("lazyCourseCombos", () => {
  it("yields one empty combo for honours projects", () => {
    const p = pipeline();
    const rng = createSeededRng(1);
    const combos = [...lazyCourseCombos(normalizeCourseCode("CSI 4900"), cache, p, ctx, rng)];
    expect(combos).toHaveLength(1);
    expect(combos[0].enrollment.times).toHaveLength(0);
  });

  it("returns null when a course has no schedule row", () => {
    const p = pipeline();
    const rng = createSeededRng(1);
    expect(buildTimetableCourse(normalizeCourseCode("ZZZ 9999"), cache, p, ctx, rng)).toBeNull();
  });

  it("filters sections by the time-window constraint", () => {
    // CSI 2110 LEC A meets 600-690; B meets 900-990. Restrict to >= 13:00.
    const p = pipeline({ ...DEFAULT_CONSTRAINTS, minStartMinutes: 780 });
    const rng = createSeededRng(1);
    const tc = buildTimetableCourse(normalizeCourseCode("CSI 2110"), cache, p, ctx, rng);
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
    const c = twoCourseCache(
      twoNonOverlappingLectureTimes("Mo"),
      twoNonOverlappingLectureTimes("Tu"),
    );
    const localCtx = contextFor(c);
    const p = new ConstraintPipeline([overlapConstraint]);
    const courses = timetableCourses(c, p, localCtx, 42);

    const arrangements = [...enumerateArrangements(courses, p, localCtx)];
    const fingerprints = new Set(arrangements.map(arrangementFingerprint));
    expect(arrangements).toHaveLength(4);
    expect(fingerprints.size).toBe(4);
  });

  it("excludes arrangements that violate inter-course overlap", () => {
    // Both courses' only section meets Mo 600-690 => always conflict => none.
    const c = twoCourseCache(
      [[{ day: "Mo", start: 600, end: 690 }]],
      [[{ day: "Mo", start: 660, end: 750 }]],
    );
    const localCtx = contextFor(c);
    const p = new ConstraintPipeline([overlapConstraint]);
    const courses = timetableCourses(c, p, localCtx, 1);
    expect([...enumerateArrangements(courses, p, localCtx)]).toHaveLength(0);
  });

  it("is exhaustive and order varies with the seed but the SET of arrangements is stable", () => {
    const c = twoCourseCache(
      [
        [{ day: "Mo", start: 600, end: 690 }],
        [{ day: "Mo", start: 720, end: 810 }],
        [{ day: "Mo", start: 900, end: 990 }],
      ],
      twoNonOverlappingLectureTimes("Tu"),
    );
    const localCtx = contextFor(c);
    const p = new ConstraintPipeline([overlapConstraint]);

    function setFor(seed: number): string[] {
      const courses = timetableCourses(c, p, localCtx, seed);
      return [...enumerateArrangements(courses, p, localCtx)].map(arrangementFingerprint);
    }

    const s1 = setFor(1);
    const s2 = setFor(2);
    expect(s1).toHaveLength(6); // 3 x 2
    expect(new Set(s1)).toEqual(new Set(s2)); // same set, regardless of order
  });
});
