import { describe, expect, it } from "vitest";
import {
  computeCourseScatter,
  computeDisciplineComparison,
  computeDisciplineYearHeatmap,
  computeGradeBandComposition,
  computeGradeHistogram,
  computeLevelComparison,
  computeProfessorSpread,
  computeSeasonComparison,
  metricValue,
} from "../gradeAnalytics";
import type { CourseGradesData } from "../dataTypes";
import type { NormalizedCourseCode } from "../brand";
import { normalizeCourseCode } from "../utils/courseUtils";

/** Build a grades dataset from compact offering tuples for readable fixtures. */
function makeGrades(
  rows: Array<{
    code: string;
    name?: string;
    termId: number;
    dist: Record<string, number>;
  }>,
): CourseGradesData {
  const byCode = new Map<NormalizedCourseCode, CourseGradesData["courses"][number]>();
  for (const row of rows) {
    const code = normalizeCourseCode(row.code);
    let entry = byCode.get(code);
    if (!entry) {
      entry = { code, professors: [] };
      byCode.set(code, entry);
    }
    entry.professors.push({
      name: row.name ?? "Prof X",
      termId: row.termId,
      distribution: row.dist,
    });
  }
  return { courses: [...byCode.values()] };
}

// A small, deterministic dataset spanning two disciplines, two levels, two
// seasons (Fall 2023 = 2239, Winter 2024 = 2241, Fall 2024 = 2249) and two profs.
const grades = makeGrades([
  { code: normalizeCourseCode("CSI 1101"), name: "Easy", termId: 2239, dist: { "A+": 80, A: 20 } }, // GPA high
  { code: normalizeCourseCode("CSI 1101"), name: "Hard", termId: 2241, dist: { C: 60, D: 40 } }, // GPA low
  {
    code: normalizeCourseCode("CSI 2110"),
    name: "Mid",
    termId: 2249,
    dist: { B: 50, "B+": 30, F: 20 },
  },
  { code: normalizeCourseCode("PSY 1101"), name: "Easy", termId: 2239, dist: { A: 100 } },
  { code: normalizeCourseCode("PSY 1101"), name: "Easy", termId: 2249, dist: { A: 100 } },
]);

describe("metricValue", () => {
  it("selects the requested metric", () => {
    const metrics = { gpa: 9, aPlusPct: 50, aRangePct: 80, passPct: 95, volume: 100 };
    expect(metricValue(metrics, "gpa")).toBe(9);
    expect(metricValue(metrics, "aPlus")).toBe(50);
    expect(metricValue(metrics, "aRange")).toBe(80);
    expect(metricValue(metrics, "pass")).toBe(95);
  });
});

describe("computeDisciplineComparison", () => {
  it("aggregates one row per discipline above the volume guard", () => {
    const rows = computeDisciplineComparison(grades, { minVolume: 1 });
    expect(rows.map((r) => r.discipline)).toEqual(["CSI", "PSY"]);
    const psy = rows.find((r) => r.discipline === "PSY");
    expect(psy?.gpa).toBe(9); // all "A"
    expect(psy?.volume).toBe(200);
  });

  it("drops disciplines below minVolume", () => {
    const rows = computeDisciplineComparison(grades, { minVolume: 350 });
    expect(rows).toHaveLength(0);
  });

  it("honors the level filter and ignores discipline", () => {
    const rows = computeDisciplineComparison(grades, { level: 2000, minVolume: 1 });
    expect(rows.map((r) => r.discipline)).toEqual(["CSI"]);
    expect(rows[0]?.volume).toBe(100);
  });
});

describe("computeGradeHistogram", () => {
  it("returns ordered bars and total for the scope", () => {
    const hist = computeGradeHistogram(grades, { discipline: "PSY" });
    expect(hist).not.toBeNull();
    expect(hist?.total).toBe(200);
    const a = hist?.bars.find((b) => b.grade === "A");
    expect(a?.count).toBe(200);
  });

  it("returns null when nothing matches", () => {
    expect(computeGradeHistogram(grades, { discipline: "ZZZ" })).toBeNull();
  });
});

describe("computeCourseScatter", () => {
  it("emits one point per course above minVolume", () => {
    const points = computeCourseScatter(grades, {}, { minVolume: 1 });
    const codes = points.map((p) => p.code).sort();
    expect(codes).toEqual([
      normalizeCourseCode("CSI 1101"),
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("PSY 1101"),
    ]);
    const psy = points.find((p) => p.code === normalizeCourseCode("PSY 1101"));
    expect(psy?.volume).toBe(200);
    expect(psy?.gpa).toBe(9);
  });

  it("drops low-volume courses", () => {
    const points = computeCourseScatter(grades, {}, { minVolume: 150 });
    expect(points.map((p) => p.code).sort()).toEqual([
      normalizeCourseCode("CSI 1101"),
      normalizeCourseCode("PSY 1101"),
    ]);
  });
});

describe("computeSeasonComparison", () => {
  it("compares seasons regardless of the season filter", () => {
    const rows = computeSeasonComparison(grades, { discipline: "CSI", season: "fall" });
    // CSI has Fall 2023 (A+/A), Winter 2024 (C/D), Fall 2024 (B/B+/F)
    const seasons = rows.map((r) => r.season);
    expect(seasons).toContain("fall");
    expect(seasons).toContain("winter");
    const fall = rows.find((r) => r.season === "fall");
    const winter = rows.find((r) => r.season === "winter");
    expect(fall?.gpa ?? 0).toBeGreaterThan(winter?.gpa ?? 0);
  });
});

describe("computeLevelComparison", () => {
  it("buckets by course level honoring discipline", () => {
    const rows = computeLevelComparison(grades, { discipline: "CSI", minVolume: 1 });
    expect(rows.map((r) => r.level)).toEqual([1000, 2000]);
  });

  it("collapses levels at or above 5000 into a single 5000+ bucket", () => {
    const gradLevels = makeGrades([
      { code: normalizeCourseCode("CSI 5101"), name: "Grad A", termId: 2239, dist: { A: 60 } },
      { code: normalizeCourseCode("CSI 6101"), name: "Grad B", termId: 2239, dist: { B: 40 } },
      { code: normalizeCourseCode("CSI 8101"), name: "Grad C", termId: 2239, dist: { C: 20 } },
    ]);
    const rows = computeLevelComparison(gradLevels, { discipline: "CSI", minVolume: 1 });
    expect(rows.map((r) => r.level)).toEqual([5000]);
    expect(rows[0]?.volume).toBe(120);
  });
});

describe("computeDisciplineYearHeatmap", () => {
  it("produces a dense discipline × year matrix", () => {
    const heatmap = computeDisciplineYearHeatmap(grades, { minCellVolume: 1 });
    expect(heatmap.years).toEqual([2023, 2024]);
    const psy = heatmap.rows.find((r) => r.discipline === "PSY");
    expect(psy?.cells).toHaveLength(2);
    // PSY has data in 2023 and 2024
    expect(psy?.cells.every((c) => c.value != null)).toBe(true);
    // CSI 2023 only has Fall data; 2024 has Winter + Fall
    const csi = heatmap.rows.find((r) => r.discipline === "CSI");
    expect(csi?.cells.find((c) => c.year === 2023)?.value).not.toBeNull();
  });

  it("nulls cells below minCellVolume", () => {
    const heatmap = computeDisciplineYearHeatmap(grades, { minCellVolume: 1000 });
    for (const row of heatmap.rows) {
      expect(row.cells.every((c) => c.value === null)).toBe(true);
    }
  });
});

describe("computeGradeBandComposition", () => {
  it("returns per-term band percentages summing to ~100", () => {
    const terms = computeGradeBandComposition(grades, { discipline: "CSI" });
    expect(terms.length).toBeGreaterThan(0);
    for (const term of terms) {
      const sum = Object.values(term.bands).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 5);
    }
    // ordered chronologically
    const ids = terms.map((t) => t.termId);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});

describe("computeProfessorSpread", () => {
  it("aggregates per professor and sorts easiest first", () => {
    const rows = computeProfessorSpread(grades, { discipline: "CSI" }, { minVolume: 1 });
    expect(rows.map((r) => r.name)).toEqual(["Easy", "Mid", "Hard"]);
    const easy = rows.find((r) => r.name === "Easy");
    expect(easy?.gpa).toBe(9.8); // 80*A+ (10) + 20*A (9) = 980/100
    expect(easy?.offerings).toBe(1);
  });

  it("drops professors below minVolume and respects limit", () => {
    const rows = computeProfessorSpread(grades, {}, { minVolume: 1, limit: 1 });
    expect(rows).toHaveLength(1);
  });
});
