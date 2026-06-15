import type { CourseGradesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { disciplineHeatmap } from "@/data/trends-data";

function makeGrades(
  rows: Array<{
    code: string;
    name: string;
    termId: number;
    distribution: Record<string, number>;
  }>,
): CourseGradesData {
  const byCode = new Map<string, CourseGradesData["courses"][number]>();
  for (const row of rows) {
    const code = normalizeCourseCode(row.code);
    let course = byCode.get(code);
    if (!course) {
      course = { code, sections: [] };
      byCode.set(code, course);
    }
    course.sections.push({
      name: row.name,
      professorRef: 0,
      termId: row.termId,
      section: "",
      distribution: row.distribution,
    });
  }
  return { courses: [...byCode.values()] };
}

const grades = makeGrades([
  // High-grading discipline, same year.
  { code: "AAA 1000", name: "Easy", termId: 2239, distribution: { "A+": 40 } },
  // Low-grading discipline, same year.
  { code: "ZZZ 1000", name: "Hard", termId: 2239, distribution: { F: 40 } },
  // Below the minimum cell volume (30) → should be null, not counted.
  { code: "BBB 1000", name: "Sparse", termId: 2239, distribution: { A: 5 } },
]);

describe("disciplineHeatmap view-model", () => {
  it("builds a discipline x year GPA matrix tinted by grade level", () => {
    const heatmap = disciplineHeatmap(grades);

    expect(heatmap.metric).toBe("gpa");
    expect(heatmap.years).toEqual([2023]);

    const byDiscipline = new Map(heatmap.rows.map((row) => [row.discipline, row]));
    const high = byDiscipline.get("AAA");
    const low = byDiscipline.get("ZZZ");

    expect(high?.cells[0]?.value).not.toBeNull();
    expect(low?.cells[0]?.value).not.toBeNull();
    expect(high?.cells[0]?.value ?? 0).toBeGreaterThan(low?.cells[0]?.value ?? 0);
    expect(high?.cells[0]?.volume).toBe(40);

    // Disciplines are returned sorted alphabetically for stable rendering.
    expect(heatmap.rows.map((row) => row.discipline)).toEqual(["AAA", "BBB", "ZZZ"]);
  });

  it("nulls out cells below the minimum counted volume", () => {
    const heatmap = disciplineHeatmap(grades);
    const sparse = heatmap.rows.find((row) => row.discipline === "BBB");

    expect(sparse?.cells[0]?.value).toBeNull();
  });
});
