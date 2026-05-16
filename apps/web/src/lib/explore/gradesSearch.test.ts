import { describe, expect, it } from "vitest";
import {
  buildCourseSearchEntries,
  buildExploreProfessorSearchEntries,
  createExploreCourseFuse,
  createExploreFuse,
  exploreProfessorsSectionFirst,
  mergeGradeDistributionCounts,
  searchExplore,
  searchExploreCourses,
  searchExploreOfferings,
  searchExploreProfessors,
  groupOfferingsByProfessor,
  type ExploreOfferingFlat,
} from "./gradesSearch";

function sampleOffering(partial: Partial<ExploreOfferingFlat>): ExploreOfferingFlat {
  const defaults: ExploreOfferingFlat = {
    id: "id",
    courseCode: "CSI 2110",
    courseTitle: "",
    professorName: "Ada Lovelace",
    termId: 2251,
    termLabel: "Fall 2025",
    fuseText: "",
    distribution: { "A+": 1 },
  };
  return {
    ...defaults,
    ...partial,
    fuseText: partial.fuseText ?? defaults.fuseText,
  };
}

describe("searchExploreOfferings", () => {
  it("matches single-character queries within the capped pool", () => {
    const offerings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "1",
        fuseText: "csi 2110 fall bob",
        professorName: "Bob",
      }),
    ];
    const fuse = createExploreFuse(offerings);
    expect(searchExploreOfferings(fuse, offerings, "c").length).toBeGreaterThan(0);
    expect(searchExploreOfferings(fuse, offerings, "cs").length).toBeGreaterThan(0);
  });

  it("caps result count", () => {
    const offerings: ExploreOfferingFlat[] = [];
    for (let i = 0; i < 300; i++) {
      offerings.push(
        sampleOffering({
          id: `x${i}`,
          fuseText: `csi ${i} fall prof smith`,
          courseCode: `CSI ${1000 + i}`,
          professorName: "Smith",
        }),
      );
    }
    const fuse = createExploreFuse(offerings);
    expect(searchExploreOfferings(fuse, offerings, "csi").length).toBeLessThanOrEqual(120);
  });
});

describe("searchExploreCourses", () => {
  it("matches courses by code or title, not professor names", () => {
    const offerings = [
      sampleOffering({
        id: "a",
        fuseText: "csi 2110 data structures fall ada",
        courseCode: "CSI 2110",
        courseTitle: "Data Structures",
        professorName: "Nobody Jones",
      }),
    ];
    const entries = buildCourseSearchEntries(offerings);
    const fuse = createExploreCourseFuse(entries);
    expect(searchExploreCourses(fuse, entries, "csi").length).toBeGreaterThan(0);
    expect(searchExploreCourses(fuse, entries, "structures").length).toBeGreaterThan(0);
    expect(searchExploreCourses(fuse, entries, "jones").length).toBe(0);
    expect(searchExploreCourses(fuse, entries, "nobody").length).toBe(0);
  });

  it("dedupes multiple sections into one course hit", () => {
    const offerings = [
      sampleOffering({
        id: "1",
        courseCode: "MAT 1341",
        courseTitle: "Calc",
        professorName: "A",
        termId: 1,
        fuseText: "x",
      }),
      sampleOffering({
        id: "2",
        courseCode: "MAT 1341",
        courseTitle: "Calc",
        professorName: "B",
        termId: 2,
        fuseText: "y",
      }),
    ];
    const entries = buildCourseSearchEntries(offerings);
    expect(entries).toHaveLength(1);
    const fuse = createExploreCourseFuse(entries);
    expect(searchExploreCourses(fuse, entries, "mat 1341")).toHaveLength(1);
  });
});

describe("mergeGradeDistributionCounts", () => {
  it("sums buckets across sections", () => {
    expect(
      mergeGradeDistributionCounts([
        { "A+": 2, A: 1 },
        { "A+": 1, B: 4 },
      ]),
    ).toEqual({ "A+": 3, A: 1, B: 4 });
  });
});

describe("searchExploreProfessors", () => {
  it("matches professor names but not unrelated courses", () => {
    const offerings = [
      sampleOffering({
        id: "a",
        fuseText: "csi 2110 fall",
        courseCode: "CSI 2110",
        professorName: "John Smith",
        legacyId: 100,
      }),
    ];
    const profEntries = buildExploreProfessorSearchEntries(offerings);
    expect(searchExploreProfessors(profEntries, "smith").map((p) => p.displayName)).toEqual([
      "John Smith",
    ]);
    const courseEntries = buildCourseSearchEntries(offerings);
    const fuse = createExploreCourseFuse(courseEntries);
    expect(searchExploreCourses(fuse, courseEntries, "smith")).toHaveLength(0);
  });
});

describe("searchExplore", () => {
  const offerings = [
    sampleOffering({
      id: "a",
      fuseText: "csi 2110 data structures fall john smith",
      courseCode: "CSI 2110",
      courseTitle: "Data Structures",
      professorName: "John Smith",
      legacyId: 100,
    }),
    sampleOffering({
      id: "b",
      fuseText: "mat 1341 calculus fall jane doe",
      courseCode: "MAT 1341",
      courseTitle: "Calculus",
      professorName: "Jane Doe",
      legacyId: 200,
    }),
  ];

  it("returns professors for name query with professorsFirst", () => {
    const courseEntries = buildCourseSearchEntries(offerings);
    const profEntries = buildExploreProfessorSearchEntries(offerings);
    const fuse = createExploreCourseFuse(courseEntries);
    const result = searchExplore("smith", {
      courseFuse: fuse,
      courseEntries,
      professorEntries: profEntries,
    });
    expect(result.professors.map((p) => p.displayName)).toEqual(["John Smith"]);
    expect(result.professorsFirst).toBe(true);
  });

  it("returns courses first for strong course code match", () => {
    const courseEntries = buildCourseSearchEntries(offerings);
    const profEntries = buildExploreProfessorSearchEntries(offerings);
    const fuse = createExploreCourseFuse(courseEntries);
    const result = searchExplore("csi 2110", {
      courseFuse: fuse,
      courseEntries,
      professorEntries: profEntries,
    });
    expect(result.courses.map((c) => c.courseCode)).toContain("CSI 2110");
    expect(result.professorsFirst).toBe(false);
  });

  it("handles only professors or only courses", () => {
    const courseEntries = buildCourseSearchEntries(offerings);
    const profEntries = buildExploreProfessorSearchEntries(offerings);
    const fuse = createExploreCourseFuse(courseEntries);
    const profOnly = searchExplore("smith", {
      courseFuse: fuse,
      courseEntries,
      professorEntries: profEntries,
    });
    expect(profOnly.professors.length).toBeGreaterThan(0);

    const courseOnly = searchExplore("mat 1341", {
      courseFuse: fuse,
      courseEntries,
      professorEntries: profEntries,
    });
    expect(courseOnly.courses.length).toBeGreaterThan(0);
  });
});

describe("exploreProfessorsSectionFirst", () => {
  it("prefers professors when rank beats course score", () => {
    expect(exploreProfessorsSectionFirst(0, 0.2)).toBe(true);
    expect(exploreProfessorsSectionFirst(2, 0.1)).toBe(false);
    expect(exploreProfessorsSectionFirst(null, 0.1)).toBe(false);
    expect(exploreProfessorsSectionFirst(0, null)).toBe(true);
  });
});

describe("groupOfferingsByProfessor", () => {
  it("groups by legacy id when present", () => {
    const groups = groupOfferingsByProfessor([
      sampleOffering({
        id: "a",
        legacyId: 10,
        professorName: "Same Person",
        courseCode: "A",
      }),
      sampleOffering({
        id: "b",
        legacyId: 10,
        professorName: "Same Person",
        courseCode: "B",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].offerings).toHaveLength(2);
    expect(groups[0].legacyId).toBe(10);
  });
});
