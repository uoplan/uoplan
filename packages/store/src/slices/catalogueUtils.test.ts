import { describe, expect, it } from "vitest";
import type { Catalogue, Course, CoursePrereqNode } from "@uoplan/core";
import { getMergedCatalogue } from "./catalogueUtils";
import { testCourseCode } from "../tests/brands";

const yearPrereq: CoursePrereqNode = { type: "course", code: testCourseCode("CSI 2110") };
const latestPrereq: CoursePrereqNode = { type: "course", code: testCourseCode("CSI 2100") };

function course(overrides: Partial<Course> & Pick<Course, "code">): Course {
  return {
    title: overrides.code,
    credits: 3,
    description: "",
    ...overrides,
  };
}

function findCourse(catalogue: Catalogue | null, code: string): Course | undefined {
  return catalogue?.courses.find((c) => c.code === code);
}

const latestCatalogue: Catalogue = {
  courses: [
    course({
      code: testCourseCode("CSI 3131"),
      title: "Latest CSI 3131",
      credits: 3,
      prerequisites: latestPrereq,
      prereqText: "CSI 2100",
    }),
    course({
      code: testCourseCode("ANP 1111"),
      title: "Latest ANP 1111",
      prerequisites: { type: "non_course", text: "Biology 4U" },
      prereqText: "Biology 4U",
    }),
    course({ code: testCourseCode("NEW 1001"), title: "New course", credits: 3 }),
    course({
      code: testCourseCode("CSI 4100"),
      title: "Latest honours",
      credits: 6,
      aliases: [testCourseCode("CSI 4100A")],
    }),
  ],
  programs: [],
};

const yearCatalogue: Course[] = [
  course({
    code: testCourseCode("CSI 3131"),
    title: "Year CSI 3131",
    credits: 3,
    prerequisites: yearPrereq,
    prereqText: "CSI 2110",
  }),
  course({ code: testCourseCode("ANP 1111"), title: "Year ANP 1111" }),
  course({ code: testCourseCode("OLD 2001"), title: "Dropped course", credits: 1.5 }),
  course({
    code: testCourseCode("CSI 4100"),
    title: "Year honours",
    credits: 3,
    prerequisites: yearPrereq,
  }),
];

describe("getMergedCatalogue", () => {
  it("returns latest catalogue when year courses are null", () => {
    const result = getMergedCatalogue(latestCatalogue, null, []);
    expect(result).toBe(latestCatalogue);
  });

  it("uses year prerequisites when both catalogues define different ASTs", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, []);
    const merged = findCourse(result, "CSI 3131");
    expect(merged?.title).toBe("Latest CSI 3131");
    expect(merged?.prerequisites).toEqual(yearPrereq);
    expect(merged?.prereqText).toBe("CSI 2110");
  });

  it("strips latest prerequisites when year row has none", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, []);
    const merged = findCourse(result, "ANP 1111");
    expect(merged?.title).toBe("Latest ANP 1111");
    expect(merged?.prerequisites).toBeUndefined();
    expect(merged?.prereqText).toBeUndefined();
  });

  it("keeps full year row for completed courses in the year catalogue", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, ["CSI 4100"]);
    const merged = findCourse(result, "CSI 4100");
    expect(merged?.title).toBe("Year honours");
    expect(merged?.credits).toBe(3);
    expect(merged?.prerequisites).toEqual(yearPrereq);
  });

  it("leaves latest-only courses unchanged", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, []);
    const merged = findCourse(result, "NEW 1001");
    expect(merged?.title).toBe("New course");
    expect(merged?.prerequisites).toBeUndefined();
  });

  it("includes year-only courses", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, []);
    const merged = findCourse(result, "OLD 2001");
    expect(merged?.title).toBe("Dropped course");
    expect(merged?.credits).toBe(1.5);
  });

  it("copies aliases from latest after prerequisite override", () => {
    const result = getMergedCatalogue(latestCatalogue, yearCatalogue, []);
    const merged = findCourse(result, "CSI 4100");
    expect(merged?.aliases).toEqual(["CSI 4100A"]);
    expect(merged?.prerequisites).toEqual(yearPrereq);
  });

  it("removes superseded alias-only rows from latest", () => {
    const catalogue: Catalogue = {
      courses: [
        course({
          code: testCourseCode("CSI 5000"),
          title: "Canonical",
          aliases: [testCourseCode("CSI 5000A")],
        }),
        course({ code: testCourseCode("CSI 5000A"), title: "Legacy alias row" }),
      ],
      programs: [],
    };
    const year: Course[] = [
      course({ code: testCourseCode("CSI 5000"), title: "Year canonical" }),
      course({ code: testCourseCode("CSI 5000A"), title: "Year legacy" }),
    ];
    const result = getMergedCatalogue(catalogue, year, []);
    const codes = result?.courses.map((c) => c.code).sort();
    expect(codes).toEqual(["CSI 5000"]);
  });
});
