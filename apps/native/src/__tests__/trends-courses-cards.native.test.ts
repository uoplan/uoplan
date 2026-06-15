import type { CourseGradesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  courseGradeBandSeries,
  courseProfessorSpread,
  courseSeasonComparison,
  disciplineCourseScatter,
  disciplineLevelComparison,
} from "@/data/trends-data";

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
  {
    code: "ITI 1120",
    name: "Easy grader",
    termId: 2239,
    distribution: { "A+": 60, A: 40 },
  },
  {
    code: "ITI 1120",
    name: "Tough grader",
    termId: 2241,
    distribution: { C: 70, D: 30 },
  },
  {
    code: "ITI 1120",
    name: "Mixed grader",
    termId: 2245,
    distribution: { B: 60, "B+": 40 },
  },
  {
    code: "ITI 2120",
    name: "Second year",
    termId: 2239,
    distribution: { A: 80, B: 40 },
  },
  {
    code: "ITI 3120",
    name: "Third year",
    termId: 2241,
    distribution: { B: 60, C: 60 },
  },
  {
    code: "MAT 1320",
    name: "Other discipline",
    termId: 2239,
    distribution: { A: 120 },
  },
]);

describe("trends courses card view-models", () => {
  it("builds grade-band percentage series for the selected course", () => {
    const bands = courseGradeBandSeries(grades, "ITI 1120");
    const byId = new Map(bands.map((band) => [band.id, band]));

    expect(byId.get("green")?.data.map((point) => point.value)).toEqual([100, 0, 0]);
    expect(byId.get("amber")?.data.map((point) => point.value)).toEqual([0, 30, 0]);
    expect(byId.get("yellow")?.data.map((point) => point.value)).toEqual([0, 70, 0]);
    expect(byId.get("blue")?.data.map((point) => point.value)).toEqual([0, 0, 100]);
    expect(byId.get("green")?.data.map((point) => point.label)).toEqual(["F23", "W24", "S24"]);
  });

  it("compares fall, winter, and spring/summer GPA for the selected course", () => {
    const seasons = courseSeasonComparison(grades, "ITI 1120");

    expect(seasons.map((season) => season.label)).toEqual(["Fall", "Winter", "Spring/summer"]);
    expect(seasons.map((season) => season.value)).toEqual([9.6, 3.4, 6.4]);
    expect(seasons.map((season) => season.volume)).toEqual([100, 100, 100]);
  });

  it("compares course levels within the selected course discipline", () => {
    const levels = disciplineLevelComparison(grades, "ITI 1120");

    expect(levels.map((level) => level.label)).toEqual(["1000", "2000", "3000"]);
    expect(levels.map((level) => level.value)).toEqual([6.47, 8, 5]);
    expect(levels.map((level) => level.volume)).toEqual([300, 120, 120]);
  });

  it("builds a popularity to GPA scatter for courses in the selected discipline", () => {
    const points = disciplineCourseScatter(grades, "ITI 1120");

    expect(points.map((point) => point.code)).toEqual(["ITI 1120", "ITI 2120", "ITI 3120"]);
    expect(points[0]).toMatchObject({ label: "ITI 1120", x: 300, y: 6.47, volume: 300, gpa: 6.47 });
    expect(points[1]).toMatchObject({ label: "ITI 2120", x: 120, y: 8, volume: 120, gpa: 8 });
  });

  it("sorts selected-course professors by GPA spread", () => {
    const professors = courseProfessorSpread(grades, "ITI 1120");

    expect(professors.map((professor) => professor.name)).toEqual([
      "Easy grader",
      "Mixed grader",
      "Tough grader",
    ]);
    expect(professors.map((professor) => professor.value)).toEqual([9.6, 6.4, 3.4]);
    expect(professors.map((professor) => professor.volume)).toEqual([100, 100, 100]);
  });
});
