import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";

import { aggregateGradeViz } from "@/data/discipline-grade-viz";

describe("aggregateGradeViz", () => {
  it("sums grade distributions and recalculates totals", () => {
    const first = normalizeGradeVizDistribution({
      "A+": 3,
      A: 2,
      F: 1,
      DR: 4,
      NS: 6,
    });
    const second = normalizeGradeVizDistribution({
      "A+": 7,
      B: 8,
      E: 9,
      DR: 10,
    });

    const aggregate = aggregateGradeViz([{ gradeViz: first }, { gradeViz: second }]);

    expect(aggregate).not.toBeNull();
    expect(aggregate?.total).toBe(50);
    expect(aggregate?.gradedTotal).toBe(36);
    expect(aggregate?.histogram.find((entry) => entry.grade === "A+")?.count).toBe(10);
    expect(aggregate?.histogram.find((entry) => entry.grade === "A")?.count).toBe(2);
    expect(aggregate?.histogram.find((entry) => entry.grade === "B")?.count).toBe(8);
    expect(aggregate?.histogram.find((entry) => entry.grade === "F")?.count).toBe(1);
    expect(aggregate?.histogram.find((entry) => entry.grade === "E")?.count).toBe(9);
    expect(aggregate?.histogram.find((entry) => entry.grade === "DR")?.count).toBe(14);
    expect(aggregate?.histogram.find((entry) => entry.grade === "NS")?.count).toBe(6);
    expect(Math.round(aggregate?.passingPercent ?? 0)).toBe(56);
  });

  it("returns null when no item has grade data", () => {
    expect(aggregateGradeViz([])).toBeNull();
    expect(aggregateGradeViz([{ gradeViz: null }, {}])).toBeNull();
  });
});
