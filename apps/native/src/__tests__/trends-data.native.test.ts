import type { CourseGradesData } from "@uoplan/core/dataTypes";

import {
  buildOverview,
  buildRisers,
  courseTermSeries,
  disciplineGpa,
  formatTermLabel,
  formatTermLabelShort,
  overallTermSeries,
  seasonGpa,
} from "@/data/trends-data";

// A small grades dataset spanning two disciplines across several terms so the
// shared analytics produce non-trivial trends. termIds follow the PeopleSoft
// convention: 21X9 = Fall 20X, 21X1 = Winter, 21X5 = Spring/Summer.
const grades: CourseGradesData = {
  courses: [
    {
      code: "ITI 1120",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2179,
          section: "",
          distribution: { "A+": 30, B: 40, F: 20 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2189,
          section: "",
          distribution: { "A+": 60, B: 40, F: 10 },
        },
        {
          name: "C",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 80, B: 40, F: 5 },
        },
      ],
    },
    {
      code: "MAT 1320",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2179,
          section: "",
          distribution: { "A+": 10, B: 20, F: 60 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2191,
          section: "",
          distribution: { "A+": 12, B: 24, F: 54 },
        },
        {
          name: "C",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 16, B: 28, F: 46 },
        },
      ],
    },
  ],
} as unknown as CourseGradesData;

describe("trends-data", () => {
  it("formats PeopleSoft term ids into season + year labels", () => {
    expect(formatTermLabel(2179)).toBe("Fall 2017");
    expect(formatTermLabel(2191)).toBe("Winter 2019");
    expect(formatTermLabel(2195)).toBe("Spring/Summer 2019");
    expect(formatTermLabelShort(2179)).toBe("F17");
    expect(formatTermLabelShort(2191)).toBe("W19");
    // Unrecognised ids fall back to the raw string.
    expect(formatTermLabel(9999)).toBe("9999");
  });

  it("builds an overview with a positive change as grades inflate", () => {
    const overview = buildOverview(grades);
    expect(overview.terms).toBeGreaterThan(0);
    expect(overview.graded).toBeGreaterThan(0);
    // Latest term GPA is higher than the first (ITI improves over time).
    expect(overview.change).toBeGreaterThan(0);
  });

  it("produces a chronological overall term series", () => {
    const series = overallTermSeries(grades);
    expect(series.length).toBeGreaterThanOrEqual(3);
    expect(series[0].label).toBe("F17");
    // values are GPA on the 0-10 scale
    for (const p of series) expect(p.value).toBeGreaterThanOrEqual(0);
  });

  it("ranks disciplines by current GPA (ITI above MAT)", () => {
    const ranked = disciplineGpa(grades);
    const codes = ranked.map((d) => d.label);
    expect(codes).toContain("ITI");
    expect(codes).toContain("MAT");
    expect(codes.indexOf("ITI")).toBeLessThan(codes.indexOf("MAT"));
  });

  it("computes a season signal for every season", () => {
    const seasons = seasonGpa(grades);
    expect(seasons.map((s) => s.label)).toEqual(["Fall", "Winter", "Spring/Summer"]);
    expect(seasons.every((s) => s.value >= 0)).toBe(true);
  });

  it("lists risers with discipline display names", () => {
    const risers = buildRisers(grades, new Map([["ITI", "Computer Science"]]));
    const iti = risers.find((r) => r.code === "ITI");
    expect(iti).toBeTruthy();
    expect(iti?.title).toBe("Computer Science");
    expect(iti?.delta).toBeGreaterThan(0);
  });

  it("builds a per-course term series sorted chronologically", () => {
    const series = courseTermSeries(grades, "ITI 1120");
    expect(series.map((p) => p.label)).toEqual(["F17", "F18", "F19"]);
    // GPA improves across the three offerings.
    expect(series[2].value).toBeGreaterThan(series[0].value);
  });
});
