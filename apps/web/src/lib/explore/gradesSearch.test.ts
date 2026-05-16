import { describe, expect, it } from "vitest";
import {
  buildCourseSearchEntries,
  createExploreCourseFuse,
  createExploreFuse,
  mergeGradeDistributionCounts,
  searchExploreCourses,
  searchExploreOfferings,
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
