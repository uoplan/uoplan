import { describe, expect, it } from "vitest";
import {
  buildAliasGroups,
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  buildOfferingsByComponent,
  buildScheduleOfferings,
  createExploreCourseFuse,
  createExploreFuse,
  dedupeCourseEntriesByComponent,
  exploreProfessorsSectionFirst,
  mergeGradeDistributionCounts,
  mergeOfferingsWithSchedule,
  searchExplore,
  searchExploreCourses,
  searchExploreOfferings,
  searchExploreProfessors,
  groupOfferingsByProfessor,
  type ExploreOfferingFlat,
} from "./gradesSearch";
import type { Catalogue, CourseSchedule, SchedulesData } from "@uoplan/core";

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

describe("buildExploreOfferings", () => {
  it("omits the 'Staff' placeholder instructor", () => {
    const offerings = buildExploreOfferings(
      {
        courses: [
          {
            code: "CSI 2110",
            professors: [
              { name: "Ada Lovelace", termId: 2251, distribution: { "A+": 1 } },
              { name: "Staff", termId: 2251, distribution: { "A+": 1 } },
              { name: "  staff ", termId: 2251, distribution: { "A+": 1 } },
            ],
          },
        ],
      },
      new Map(),
      new Map(),
    );
    expect(offerings.map((o) => o.professorName)).toEqual(["Ada Lovelace"]);
  });
});

function scheduleSection(
  section: string,
  component: string,
  instructors: Array<string | null>,
): CourseSchedule["components"][string][number] {
  return {
    section,
    sectionCode: section.slice(0, 3),
    component,
    session: null,
    status: "Open",
    times: instructors.map((instructor) => ({
      day: "Mo",
      startMinutes: 540,
      endMinutes: 630,
      virtual: false,
      instructor,
    })),
  };
}

function scheduleData(termId: string, schedules: CourseSchedule[]): SchedulesData {
  return { termId, schedules };
}

describe("buildScheduleOfferings", () => {
  it("omits the 'Staff' placeholder instructor", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ADM",
            catalogNumber: "1100",
            courseCode: "ADM 1100",
            title: "Intro to Business",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection("A00-LEC FullSess.", "LEC", ["Real Prof"]),
                scheduleSection("B00-LEC FullSess.", "LEC", ["Staff"]),
              ],
            },
          },
        ]),
      ],
      new Map([[2271, "Winter 2027"]]),
      new Map(),
    );
    expect(offerings.map((o) => o.professorName)).toEqual(["Real Prof"]);
  });

  it("combines multiple sections of the same prof/term into one section-less offering", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ADM",
            catalogNumber: "1100",
            courseCode: "ADM 1100",
            title: "Intro to Business",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection("A00-LEC FullSess.", "LEC", ["Alan O'Sullivan"]),
                scheduleSection("B00-LEC FullSess.", "LEC", ["Alan O'Sullivan"]),
              ],
              DGD: [scheduleSection("D01-DGD FullSess.", "DGD", ["Alan O'Sullivan"])],
            },
          },
        ]),
      ],
      new Map([[2271, "Winter 2027"]]),
      new Map(),
    );
    expect(offerings).toHaveLength(1);
    expect(offerings[0].professorName).toBe("Alan O'Sullivan");
    expect(offerings[0].section).toBeUndefined();
    expect(offerings[0].fuseText).not.toContain("fullsess");
  });
});

describe("mergeOfferingsWithSchedule", () => {
  it("dedups schedule rows against grade rows by prof/term ignoring section", () => {
    const gradeOfferings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "grade",
        courseCode: "ADM 1100",
        professorName: "Alan O'Sullivan",
        termId: 2271,
        section: "A00",
      }),
    ];
    const scheduleOfferings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "sched-dup",
        courseCode: "ADM 1100",
        professorName: "Alan O'Sullivan",
        termId: 2271,
        section: undefined,
        distribution: {},
      }),
      sampleOffering({
        id: "sched-new",
        courseCode: "ADM 1100",
        professorName: "New Prof",
        termId: 2271,
        section: undefined,
        distribution: {},
      }),
    ];
    const merged = mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
    expect(merged.map((o) => o.id)).toEqual(["grade", "sched-new"]);
  });
});

function aliasCatalogue(rows: { code: string; title?: string; aliases?: string[] }[]): Catalogue {
  return {
    courses: rows.map((r) => ({
      code: r.code,
      title: r.title ?? "",
      credits: 3,
      description: "",
      aliases: r.aliases,
    })),
    programs: [],
  } as unknown as Catalogue;
}

describe("buildAliasGroups", () => {
  it("unions transitively and keys components by the smallest member code", () => {
    // A -> B, B -> C should collapse into a single component {A,B,C}.
    const { componentByNorm, membersByComponent } = buildAliasGroups(
      aliasCatalogue([
        { code: "STA 2391", aliases: ["MAT 2377"] },
        { code: "MAT 2377", aliases: ["MAT 2371"] },
      ]),
    );
    const id = componentByNorm.get("STA 2391");
    expect(id).toBe("MAT 2371"); // lexicographically smallest
    expect(componentByNorm.get("MAT 2377")).toBe(id);
    expect(componentByNorm.get("MAT 2371")).toBe(id);
    expect(membersByComponent.get("MAT 2371")).toEqual(["MAT 2371", "MAT 2377", "STA 2391"]);
  });

  it("merges hub aliases shared by distinct courses into one component", () => {
    const { componentByNorm, membersByComponent } = buildAliasGroups(
      aliasCatalogue([
        { code: "ART 3916", aliases: ["ART 3016"] },
        { code: "ART 3917", aliases: ["ART 3016"] },
      ]),
    );
    const id = componentByNorm.get("ART 3916");
    expect(componentByNorm.get("ART 3917")).toBe(id);
    expect(componentByNorm.get("ART 3016")).toBe(id);
    expect(membersByComponent.get(id as string)).toHaveLength(3);
  });

  it("omits courses with no alias relation (standalone)", () => {
    const { componentByNorm } = buildAliasGroups(aliasCatalogue([{ code: "CSI 2110" }]));
    expect(componentByNorm.has("CSI 2110")).toBe(false);
  });

  it("returns empty groups for a null catalogue", () => {
    const groups = buildAliasGroups(null);
    expect(groups.componentByNorm.size).toBe(0);
    expect(groups.membersByComponent.size).toBe(0);
  });
});

describe("alias-aware course aggregation", () => {
  const catalogue = aliasCatalogue([
    { code: "STA 2391", title: "Probability", aliases: ["MAT 2377"] },
  ]);
  const { componentByNorm, membersByComponent } = buildAliasGroups(catalogue);
  const titleByCode = new Map([
    ["STA 2391", "Probability"],
    ["MAT 2377", "Probability"],
  ]);

  // Data is split across the two codes: old code MAT 2377 and new code STA 2391.
  const offerings = [
    sampleOffering({
      id: "old",
      courseCode: "MAT 2377",
      courseTitle: "Probability",
      professorName: "Old Prof",
      termId: 2191,
      distribution: { "A+": 2 },
    }),
    sampleOffering({
      id: "new",
      courseCode: "STA 2391",
      courseTitle: "Probability",
      professorName: "New Prof",
      termId: 2251,
      distribution: { B: 4 },
    }),
  ];

  it("buckets offerings from both codes into one component", () => {
    const byComponent = buildOfferingsByComponent(offerings, componentByNorm);
    expect(byComponent.size).toBe(1);
    expect(byComponent.get("MAT 2377")).toHaveLength(2);
  });

  it("exposes merged grade stats on every member entry", () => {
    const entries = buildCourseSearchEntries(
      offerings,
      titleByCode,
      null,
      componentByNorm,
      membersByComponent,
    );
    const sta = entries.find((e) => e.normCode === "STA 2391");
    const mat = entries.find((e) => e.normCode === "MAT 2377");
    expect(sta?.componentId).toBe("MAT 2377");
    expect(mat?.componentId).toBe("MAT 2377");
    // Both expose the combined A+ and B counts from the two codes.
    const total = (g: typeof sta) =>
      g?.gradeViz?.histogram.reduce((sum, h) => sum + h.count, 0) ?? 0;
    expect(total(sta)).toBe(6);
    expect(total(mat)).toBe(6);
  });

  it("synthesizes a searchable entry for an alias code with no offerings of its own", () => {
    const onlyNew = [offerings[1]]; // only STA 2391 has offerings
    const entries = buildCourseSearchEntries(
      onlyNew,
      titleByCode,
      null,
      componentByNorm,
      membersByComponent,
    );
    const mat = entries.find((e) => e.normCode === "MAT 2377");
    expect(mat).toBeDefined();
    expect(mat?.courseTitle).toBe("Probability");
    const fuse = createExploreCourseFuse(entries);
    // Searching the old code surfaces the merged course displayed under that code.
    const hit = searchExploreCourses(fuse, entries, "mat 2377");
    expect(hit.map((e) => e.normCode)).toContain("MAT 2377");
  });

  it("dedupes search results to one entry per alias component", () => {
    const entries = buildCourseSearchEntries(
      offerings,
      titleByCode,
      null,
      componentByNorm,
      membersByComponent,
    );
    const fuse = createExploreCourseFuse(entries);
    // "probability" matches both member titles; only one component result should remain.
    const hits = searchExploreCourses(fuse, entries, "probability");
    expect(hits).toHaveLength(1);
  });
});

describe("dedupeCourseEntriesByComponent", () => {
  it("keeps the first entry per component in input order", () => {
    const entries = buildCourseSearchEntries(
      [
        sampleOffering({ id: "1", courseCode: "MAT 2377" }),
        sampleOffering({ id: "2", courseCode: "STA 2391" }),
        sampleOffering({ id: "3", courseCode: "CSI 2110" }),
      ],
      null,
      null,
      new Map([
        ["MAT 2377", "MAT 2377"],
        ["STA 2391", "MAT 2377"],
      ]),
      new Map([["MAT 2377", ["MAT 2377", "STA 2391"]]]),
    );
    const deduped = dedupeCourseEntriesByComponent(entries);
    const codes = deduped.map((e) => e.componentId).sort();
    expect(codes).toEqual(["CSI 2110", "MAT 2377"]);
  });
});
