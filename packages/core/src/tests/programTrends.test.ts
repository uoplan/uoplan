import { describe, expect, it } from "vitest";
import {
  availablePrograms,
  buildProgramCourseFilter,
  programFilterMatches,
  programSlug,
} from "../programTrends";
import { computeGradeTrends } from "../gradeTrends";
import type { CourseGradesData, Program } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

const program: Program = {
  title: "Honours BSc Computer Science",
  url: "https://catalogue.uottawa.ca/en/undergrad/honours-bsc-computer-science/",
  slug: "undergrad/honours-bsc-computer-science",
  requirements: [
    {
      type: "and",
      title: "Compulsory:",
      options: [
        { type: "course", code: normalizeCourseCode("CSI 2110") },
        { type: "course", code: normalizeCourseCode("MAT 1320") },
        {
          type: "options_group",
          options: [
            {
              type: "and",
              options: [
                { type: "or_course", code: normalizeCourseCode("CSI 2372") },
                {
                  type: "pick",
                  options: [
                    {
                      type: "discipline_elective",
                      title: "Any CSI at 4000 level",
                      disciplineLevels: [{ discipline: "CSI", levels: [4000] }],
                    },
                    {
                      type: "discipline_elective",
                      title: "Any SEG (any level)",
                      disciplineLevels: [{ discipline: "SEG" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        // Broad electives — must be ignored.
        { type: "free_elective", title: "3 units free elective", credits: 3 },
        {
          type: "non_discipline_elective",
          title: "27 units non-computing",
          credits: 27,
        },
        { type: "faculty_elective", title: "Faculty elective" },
        { type: "elective", title: "Generic elective" },
      ],
    },
  ],
};

describe("buildProgramCourseFilter", () => {
  it("collects concrete codes and discipline pools, ignoring broad electives", () => {
    const filter = buildProgramCourseFilter(program);
    expect([...filter.codes].sort()).toEqual([
      normalizeCourseCode("CSI 2110"),
      normalizeCourseCode("CSI 2372"),
      normalizeCourseCode("MAT 1320"),
    ]);
    expect(filter.pools).toEqual([
      { discipline: "CSI", levels: [4000] },
      { discipline: "SEG", levels: undefined },
    ]);
  });

  it("normalises course codes", () => {
    const filter = buildProgramCourseFilter({
      ...program,
      requirements: [{ type: "course", code: "csi2110" }],
    });
    expect(filter.codes.has(normalizeCourseCode("CSI 2110"))).toBe(true);
  });
});

describe("programFilterMatches", () => {
  const filter = buildProgramCourseFilter(program);

  it("matches explicit core codes (case/space-insensitive)", () => {
    expect(programFilterMatches(filter, normalizeCourseCode("CSI 2110"))).toBe(true);
    expect(programFilterMatches(filter, "csi2110")).toBe(true);
    expect(programFilterMatches(filter, normalizeCourseCode("MAT 1320"))).toBe(true);
  });

  it("matches a discipline+level pool only at the right level", () => {
    expect(programFilterMatches(filter, normalizeCourseCode("CSI 4120"))).toBe(true); // CSI 4000 pool
    expect(programFilterMatches(filter, normalizeCourseCode("CSI 3120"))).toBe(false); // CSI but wrong level, not explicit
  });

  it("matches any level for a pool without levels", () => {
    expect(programFilterMatches(filter, normalizeCourseCode("SEG 2105"))).toBe(true);
    expect(programFilterMatches(filter, normalizeCourseCode("SEG 4910"))).toBe(true);
  });

  it("rejects unrelated disciplines and uncodeable input", () => {
    expect(programFilterMatches(filter, normalizeCourseCode("PSY 1101"))).toBe(false);
    expect(programFilterMatches(filter, "not a code")).toBe(false);
  });
});

describe("programSlug", () => {
  it("prefers the explicit slug, else derives from the URL", () => {
    expect(programSlug(program)).toBe("undergrad/honours-bsc-computer-science");
    expect(
      programSlug({
        title: "X",
        url: "https://catalogue.uottawa.ca/en/graduate/msc-cs/",
        requirements: [],
      }),
    ).toBe("graduate/msc-cs");
  });
});

const grades: CourseGradesData = {
  courses: [
    {
      code: normalizeCourseCode("CSI 2110"),
      sections: [{ name: "A", termId: 2179, distribution: { "A+": 100 } }],
    },
    {
      code: normalizeCourseCode("CSI 4120"),
      sections: [{ name: "B", termId: 2179, distribution: { A: 50, F: 50 } }],
    },
    {
      code: normalizeCourseCode("PSY 1101"),
      sections: [{ name: "C", termId: 2179, distribution: { "A+": 80 } }],
    },
    {
      // No graded mass — should not make a program "available".
      code: normalizeCourseCode("BIO 1130"),
      sections: [{ name: "D", termId: 2179, distribution: { P: 10 } }],
    },
  ],
};

describe("availablePrograms", () => {
  it("returns only programs whose core courses have grade data, deduped and sorted", () => {
    const csOnly = { ...program };
    const bioProgram: Program = {
      title: "BSc Biology",
      url: "https://catalogue.uottawa.ca/en/undergrad/bsc-biology/",
      slug: "undergrad/bsc-biology",
      requirements: [{ type: "course", code: normalizeCourseCode("BIO 1130") }],
    };
    const psyProgram: Program = {
      title: "Anonymous Psychology",
      url: "https://catalogue.uottawa.ca/en/undergrad/psych/",
      slug: "undergrad/psych",
      requirements: [{ type: "course", code: normalizeCourseCode("PSY 1101") }],
    };
    const duplicate = { ...csOnly };

    const result = availablePrograms(grades, [csOnly, bioProgram, psyProgram, duplicate]);
    expect(result.map((p) => p.title)).toEqual([
      "Anonymous Psychology",
      "Honours BSc Computer Science",
    ]);
  });
});

describe("computeGradeTrends with programFilter", () => {
  it("restricts the series to the program's core courses", () => {
    const filter = buildProgramCourseFilter(program);
    const { points } = computeGradeTrends(grades, { programFilter: filter });
    // Only CSI 2110 (A+ 100) and CSI 4120 (A 50, F 50) count; PSY/BIO excluded.
    expect(points).toHaveLength(1);
    expect(points[0].volume).toBe(200);
  });

  it("intersects with the discipline filter", () => {
    const filter = buildProgramCourseFilter(program);
    const { points } = computeGradeTrends(grades, { programFilter: filter, discipline: "CSI" });
    expect(points[0].volume).toBe(200);
    const none = computeGradeTrends(grades, { programFilter: filter, discipline: "PSY" });
    expect(none.points).toHaveLength(0);
  });

  it("intersects with the level filter", () => {
    const filter = buildProgramCourseFilter(program);
    const { points } = computeGradeTrends(grades, { programFilter: filter, level: 4000 });
    expect(points[0].volume).toBe(100); // only CSI 4120
  });
});
