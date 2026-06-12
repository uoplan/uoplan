import { describe, expect, it } from "vitest";
import {
  aggregateCourseDistribution,
  buildCourseDifficultyIndexFromCache,
  courseAPlusPercent,
  courseGpa,
  distributionGpa,
  GRADE_POINTS,
  normalizeGradeVizDistribution,
} from "../gradeDistribution";
import type { ComponentSection, CourseSchedule } from "../dataTypes";
import type { DataCache } from "../dataCache";
import { normalizeCourseCode } from "../utils/courseUtils";

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

  it("excludes DR (withdrawals) from GPA and from the visualization", () => {
    // DR is a withdrawal bucket carried in the data but never an academic outcome:
    // it must not move the GPA nor appear in any viz bucket / total.
    expect(distributionGpa({ "A+": 5, DR: 100 })).toBeCloseTo(10, 5);
    expect(distributionGpa({ DR: 5 })).toBeNull();

    const viz = normalizeGradeVizDistribution({ A: 4, DR: 6 });
    expect(viz?.total).toBe(4); // DR ignored, only A counted
    expect(viz?.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(4);
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
    expect(viz.buckets.find((b) => b.id === "red")?.count).toBe(4); // F + EIN + NS
    expect(viz.buckets.find((b) => b.id === "blue")?.count).toBe(4); // B + S
    expect(viz.buckets.find((b) => b.id === "green")?.count).toBe(5); // A + P
    expect(viz.passingPercent).toBeCloseTo((14 / 18) * 100, 5);
  });

  it("normalizeGradeVizDistribution returns null for empty or unknown data", () => {
    expect(normalizeGradeVizDistribution({})).toBeNull();
    expect(normalizeGradeVizDistribution({ XYZ: 10 })).toBeNull();
    expect(normalizeGradeVizDistribution(null)).toBeNull();
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
});
