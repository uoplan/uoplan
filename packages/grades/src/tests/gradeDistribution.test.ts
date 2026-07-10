import { describe, expect, it } from "vitest";
import {
  aggregateCourseDistribution,
  buildCourseDifficultyIndexFromCache,
  buildGradeHistogramModel,
  courseAPlusPercent,
  courseGpa,
  distributionGpa,
  failingFraction,
  gpaToLetterGrade,
  GRADE_POINTS,
  gradeVizGpa,
  normalizeGradeVizDistribution,
} from "../gradeDistribution";
import type { ComponentSection, CourseSchedule } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

const minimalSection = (distribution: Record<string, number>): ComponentSection => ({
  section: "X",
  sectionCode: "X",
  component: "LEC",
  session: null,
  times: [{ day: "Mo", startMinutes: 600, endMinutes: 660, virtual: false }],
  status: null,
  distribution,
});

describe("gradeDistribution", () => {
  it("distributionGpa computes weighted mean over counted grades", () => {
    const dist = { A: 10, B: 10, F: 0, P: 5 };
    const gpa = distributionGpa(dist);
    expect(gpa).toBeCloseTo((10 * GRADE_POINTS.A + 10 * GRADE_POINTS.B) / 20, 5);
  });

  it("distributionGpa returns null when only non-counted grades", () => {
    expect(distributionGpa({ P: 1, S: 2 })).toBeNull();
  });

  it("uses the uOttawa 10-point scale (A+ → 10, F → 0)", () => {
    expect(GRADE_POINTS["A+"]).toBe(10);
    expect(GRADE_POINTS.F).toBe(0);
    expect(distributionGpa({ "A+": 5 })).toBeCloseTo(10, 5);
    expect(distributionGpa({ F: 5 })).toBeCloseTo(0, 5);
  });

  it("keeps DR (withdrawals) out of GPA but surfaces it as a neutral viz bucket", () => {
    // DR is a withdrawal: it must never move the GPA, and in the visualization it is a
    // neutral "Withdrew" bucket — counted in the overall total but excluded from the
    // graded total that drives passing% / A+%.
    expect(distributionGpa({ "A+": 5, DR: 100 })).toBeCloseTo(10, 5);
    expect(distributionGpa({ DR: 5 })).toBeNull();

    const viz = normalizeGradeVizDistribution({ A: 4, DR: 6 });
    expect(viz?.total).toBe(10); // A + DR
    expect(viz?.gradedTotal).toBe(4); // DR excluded from graded mass
    expect(viz?.buckets.find((b) => b.id === "grey")?.count).toBe(6); // DR -> Withdrew bucket
    expect(viz?.buckets.find((b) => b.id === "green")?.count).toBe(4); // A
    expect(viz?.passingPercent).toBeCloseTo(100, 5); // 4 graded, 0 failing
  });

  it("aggregateCourseDistribution sums section distributions", () => {
    const schedule: CourseSchedule = {
      subject: "ADM",
      catalogNumber: "1100",
      courseCode: normalizeCourseCode("ADM 1100"),
      title: null,
      timeZone: "America/Toronto",
      components: {
        LEC: [minimalSection({ A: 2, B: 1 }), minimalSection({ B: 1, C: 3 })],
      },
    };

    const agg = aggregateCourseDistribution(schedule);
    expect(agg.A).toBe(2);
    expect(agg.B).toBe(2);
    expect(agg.C).toBe(3);
    expect(courseGpa(schedule)).not.toBeNull();
  });

  it("normalizeGradeVizDistribution blends letter and pass/fail schemes", () => {
    const viz = normalizeGradeVizDistribution({
      F: 2,
      EIN: 1,
      D: 1,
      C: 2,
      B: 3,
      S: 1,
      "A-": 2,
      A: 4,
      P: 1,
      NS: 1,
    });

    expect(viz).not.toBeNull();
    if (!viz) return;

    expect(viz.total).toBe(18);
    expect(viz.gradedTotal).toBe(18); // no withdrawals
    expect(viz.buckets.find((b) => b.id === "red")?.count).toBe(4); // F + EIN + NS
    expect(viz.buckets.find((b) => b.id === "blue")?.count).toBe(4); // B + S
    expect(viz.buckets.find((b) => b.id === "green")?.count).toBe(5); // A + P
    expect(viz.buckets.find((b) => b.id === "grey")?.count).toBe(0); // no DR
    expect(viz.passingPercent).toBeCloseTo((14 / 18) * 100, 5);
  });

  it("normalizeGradeVizDistribution returns null for empty or unknown data", () => {
    expect(normalizeGradeVizDistribution({})).toBeNull();
    expect(normalizeGradeVizDistribution({ XYZ: 10 })).toBeNull();
    expect(normalizeGradeVizDistribution(null)).toBeNull();
  });

  it("failingFraction is the exact complement of passingPercent", () => {
    // Mix of letter fails (F), administrative fail (EIN), pass/fail fail (NS),
    // passes (A) and withdrawals (DR) — DR must be excluded from the denominator.
    const dist = { A: 40, F: 50, EIN: 10, NS: 5, DR: 20 };
    const viz = normalizeGradeVizDistribution(dist);
    expect(viz).not.toBeNull();
    if (!viz) return;

    // red = F + EIN + NS = 65; gradedTotal = total(125) - DR(20) = 105.
    expect(failingFraction(dist)).toBeCloseTo(65 / 105, 5);
    // The two figures always sum to 1 (i.e. "% fail" + "% passing" = 100%).
    expect(failingFraction(dist) + viz.passingPercent / 100).toBeCloseTo(1, 5);
  });

  it("failingFraction returns 0 when there is no graded mass", () => {
    expect(failingFraction({})).toBe(0);
    expect(failingFraction({ DR: 10 })).toBe(0); // only withdrawals
    expect(failingFraction(null)).toBe(0);
  });
});

describe("buildCourseDifficultyIndexFromCache", () => {
  const schedule: CourseSchedule = {
    subject: "ADM",
    catalogNumber: "1100",
    courseCode: normalizeCourseCode("ADM 1100"),
    title: null,
    timeZone: "America/Toronto",
    components: {
      LEC: [minimalSection({ "A+": 5, A: 5, B: 10 })],
    },
  };

  it("matches courseAPlusPercent for a known course and memoizes lookups", () => {
    let lookups = 0;
    const cache = {
      getSchedule: (code: string) => {
        lookups++;
        return code === normalizeCourseCode("ADM 1100") ? schedule : undefined;
      },
    } as unknown as DataCache;

    const index = buildCourseDifficultyIndexFromCache(cache);
    expect(index(normalizeCourseCode("ADM 1100"))).toBe(courseAPlusPercent(schedule));
    expect(index(normalizeCourseCode("ADM 1100"))).toBe(courseAPlusPercent(schedule));
    expect(lookups).toBe(1); // second call served from memo
  });

  it("returns null for a course with no schedule data", () => {
    const cache = { getSchedule: () => {} } as unknown as DataCache;
    const index = buildCourseDifficultyIndexFromCache(cache);
    expect(index(normalizeCourseCode("MAT 0000"))).toBeNull();
  });

  it("buildGradeHistogramModel orders bars DR → Fail → letters and merges failures", () => {
    const viz = normalizeGradeVizDistribution({
      DR: 3,
      F: 2,
      EIN: 1,
      ABS: 1,
      D: 4,
      "C+": 5,
      B: 6,
      "A+": 10,
      S: 8,
      NS: 2,
    });
    expect(viz).not.toBeNull();
    const model = buildGradeHistogramModel(viz!);

    // 11 bars: DR + Fail + 9 letter bars (D..A+).
    expect(model.displayBars.map((b) => b.key)).toEqual([
      "DR",
      "FAIL",
      "D",
      "D+",
      "C",
      "C+",
      "B",
      "B+",
      "A-",
      "A",
      "A+",
    ]);

    const byKey = new Map(model.displayBars.map((b) => [b.key, b]));
    expect(byKey.get("DR")?.count).toBe(3);
    expect(byKey.get("DR")?.bucketId).toBe("grey");
    // F + EIN + ABS merged into the single Fail bar.
    expect(byKey.get("FAIL")?.count).toBe(4);
    expect(byKey.get("FAIL")?.bucketId).toBe("red");
    expect(byKey.get("A+")?.count).toBe(10);
    expect(byKey.get("A+")?.bucketId).toBe("green");

    // S/NS aggregated separately from the letter bars. S must remain in the
    // normalized histogram so pass/fail mass matches passingPercent.
    expect(model.sCount).toBe(8);
    expect(model.nsCount).toBe(2);
    expect(model.snsTotal).toBe(10);

    // Bar-height scaling uses the tallest bar (A+ = 10).
    expect(model.maxHistogramCount).toBe(10);
  });

  it("keeps satisfactory grades visible in the S/NS histogram bar", () => {
    const viz = normalizeGradeVizDistribution({ F: 2, S: 21 });

    expect(viz).not.toBeNull();
    if (!viz) return;

    expect(Math.round(viz.passingPercent)).toBe(91);
    expect(viz.histogram.find((entry) => entry.grade === "S")?.count).toBe(21);

    const model = buildGradeHistogramModel(viz);
    const failBar = model.displayBars.find((bar) => bar.key === "FAIL");
    expect(model.sCount).toBe(21);
    expect(model.snsTotal).toBe(21);
    expect(failBar?.count).toBe(2);
  });

  it("keeps pass grades visible in the S/NS histogram bar", () => {
    const viz = normalizeGradeVizDistribution({ P: 55 });

    expect(viz).not.toBeNull();
    if (!viz) return;

    expect(viz.passingPercent).toBe(100);
    expect(viz.histogram.find((entry) => entry.grade === "P")?.count).toBe(55);

    const model = buildGradeHistogramModel(viz);
    expect(model.sCount).toBe(55);
    expect(model.snsTotal).toBe(55);
  });

  describe("gpaToLetterGrade", () => {
    it("maps each grade point exactly back to its letter", () => {
      for (const [letter, points] of Object.entries(GRADE_POINTS)) {
        expect(gpaToLetterGrade(points)).toBe(letter);
      }
    });

    it("rounds to the nearest letter and breaks .5 ties toward the better grade", () => {
      // 8.4 is closest to A- (8) vs A (9) -> A- ; 8.6 closer to A.
      expect(gpaToLetterGrade(8.4)).toBe("A-");
      expect(gpaToLetterGrade(8.6)).toBe("A");
      // Exactly between B+ (7) and A- (8) rounds up to A-.
      expect(gpaToLetterGrade(7.5)).toBe("A-");
    });

    it("is monotonic non-decreasing so a higher mean never maps to a lower letter", () => {
      let prev = -1;
      for (let gpa = 0; gpa <= 10.0001; gpa += 0.1) {
        const letter = gpaToLetterGrade(gpa);
        expect(letter).not.toBeNull();
        const points = GRADE_POINTS[letter as string];
        expect(points).toBeGreaterThanOrEqual(prev);
        prev = points;
      }
    });

    it("returns null for nullish / non-finite input", () => {
      const missing: number | undefined = undefined;
      expect(gpaToLetterGrade(null)).toBeNull();
      expect(gpaToLetterGrade(missing)).toBeNull();
      expect(gpaToLetterGrade(Number.NaN)).toBeNull();
    });
  });

  describe("gradeVizGpa", () => {
    it("matches distributionGpa over the same distribution", () => {
      const dist = { "A+": 5, A: 10, "B+": 4, F: 3, DR: 7, P: 2 };
      const viz = normalizeGradeVizDistribution(dist);
      expect(gradeVizGpa(viz)).toBeCloseTo(distributionGpa(dist) ?? Number.NaN, 5);
    });

    it("returns null for null gradeViz", () => {
      expect(gradeVizGpa(null)).toBeNull();
    });

    it("excludes withdrawals (DR) from the mean, mirroring distributionGpa", () => {
      const withDr = normalizeGradeVizDistribution({ A: 4, F: 4, DR: 100 });
      const withoutDr = normalizeGradeVizDistribution({ A: 4, F: 4 });
      expect(gradeVizGpa(withDr)).toBeCloseTo(gradeVizGpa(withoutDr) ?? Number.NaN, 5);
    });
  });
});
