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
  it("keeps the 'Staff' placeholder as an unassigned offering (no professor)", () => {
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
    );

    // Real professor preserved.
    const real = offerings.filter((o) => !o.unassignedInstructor);
    expect(real.map((o) => o.professorName)).toEqual(["Ada Lovelace"]);

    // "Staff" rows are kept but stripped of a real instructor.
    const unassigned = offerings.filter((o) => o.unassignedInstructor);
    expect(unassigned.length).toBeGreaterThan(0);
    for (const o of unassigned) {
      expect(o.professorName).toBe("");
      expect(o.legacyId).toBeUndefined();
      expect(o.fuseText).not.toContain("staff");
    }

    // The placeholder never becomes a searchable professor.
    const profEntries = buildExploreProfessorSearchEntries(offerings);
    expect(profEntries.map((e) => e.displayName)).toEqual(["Ada Lovelace"]);
  });
});

function scheduleSection(
  section: string,
  component: string,
  instructors: Array<string | null>,
  predictedInstructors?: Array<{ name: string; legacyId?: number }>,
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
    predictedInstructors,
  };
}

function scheduleData(termId: string, schedules: CourseSchedule[]): SchedulesData {
  return { termId, schedules };
}

describe("buildScheduleOfferings", () => {
  it("keeps a 'Staff' section as an unassigned offering instead of dropping it", () => {
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
      new Map(),
    );

    const real = offerings.filter((o) => !o.unassignedInstructor);
    expect(real.map((o) => o.professorName)).toEqual(["Real Prof"]);

    const unassigned = offerings.filter((o) => o.unassignedInstructor);
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0].professorName).toBe("");
    expect(unassigned[0].fuseText).not.toContain("staff");
  });

  it("keeps a Staff-only course searchable with a single unassigned group", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2275", [
          {
            subject: "BIO",
            catalogNumber: "3350",
            courseCode: "BIO 3350",
            title: "Some Bio Course",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection("A00-LEC FullSess.", "LEC", ["Staff"]),
                scheduleSection("B00-LEC FullSess.", "LEC", ["Staff"]),
              ],
            },
          },
        ]),
      ],
      new Map(),
    );

    // One unassigned offering survives, so the course is indexable.
    expect(offerings).toHaveLength(1);
    expect(offerings[0].unassignedInstructor).toBe(true);

    const courseEntries = buildCourseSearchEntries(offerings);
    expect(courseEntries.map((e) => e.normCode)).toContain("BIO 3350");

    // The unassigned section forms one non-professor group, and no prof is indexed.
    const groups = groupOfferingsByProfessor(offerings);
    expect(groups).toHaveLength(1);
    expect(groups[0].unassigned).toBe(true);
    expect(buildExploreProfessorSearchEntries(offerings)).toHaveLength(0);
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
      new Map(),
    );
    expect(offerings).toHaveLength(1);
    expect(offerings[0].professorName).toBe("Alan O'Sullivan");
    expect(offerings[0].section).toBeUndefined();
    expect(offerings[0].fuseText).not.toContain("fullsess");
  });

  it("unions predicted instructors across a course/term into one unassigned offering", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: "ITI 1120",
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection(
                  "A00-LEC FullSess.",
                  "LEC",
                  ["Staff"],
                  [
                    { name: "Ann Bee", legacyId: 1 },
                    { name: "Cy Dee", legacyId: 3 },
                  ],
                ),
                // Overlapping guess (Ann) plus a new one (Em) → all unioned.
                scheduleSection(
                  "C00-LEC FullSess.",
                  "LEC",
                  ["Staff"],
                  [
                    { name: "Ann Bee", legacyId: 1 },
                    { name: "Em Eff", legacyId: 5 },
                  ],
                ),
                // No guess of its own, but keeps the term unassigned.
                scheduleSection("D00-LEC FullSess.", "LEC", ["Staff"]),
              ],
            },
          },
        ]),
      ],
      new Map(),
    );

    const unassigned = offerings.filter((o) => o.unassignedInstructor);
    // Two unassigned rows: the predicted union, plus a no-guess row for D00 so the
    // genuinely-unpredicted section still surfaces.
    expect(unassigned).toHaveLength(2);
    const predictedRow = unassigned.find((o) => (o.predictedInstructors?.length ?? 0) > 0);
    expect(predictedRow?.predictedInstructors?.map((p) => p.legacyId).sort()).toEqual([1, 3, 5]);
    const noGuessRow = unassigned.find((o) => !o.predictedInstructors?.length);
    expect(noGuessRow).toBeDefined();
  });

  it("fans an unassigned offering out as a predicted row under each candidate prof", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: "ITI 1120",
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection(
                  "A00-LEC FullSess.",
                  "LEC",
                  ["Staff"],
                  [
                    { name: "Ann Bee", legacyId: 1 },
                    { name: "Cy Dee", legacyId: 3 },
                  ],
                ),
              ],
            },
          },
        ]),
      ],
      new Map(),
    );

    const groups = groupOfferingsByProfessor(offerings);
    // No unassigned group: every guess landed under a professor instead.
    expect(groups.some((g) => g.unassigned)).toBe(false);
    expect(groups.map((g) => g.displayName).sort()).toEqual(["Ann Bee", "Cy Dee"]);
    for (const g of groups) {
      expect(g.hasPredicted).toBe(true);
      expect(g.offerings).toHaveLength(1);
      expect(g.offerings[0].predicted).toBe(true);
      expect(g.offerings[0].unassignedInstructor).toBe(false);
    }
    // legacyId is carried through so the group links to the professor page.
    expect(groups.find((g) => g.displayName === "Cy Dee")?.legacyId).toBe(3);
  });

  it("keeps a no-guess unassigned section in the shared unassigned group", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: "ITI 1120",
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: { LEC: [scheduleSection("A00-LEC FullSess.", "LEC", ["Staff"])] },
          },
        ]),
      ],
      new Map(),
    );
    const groups = groupOfferingsByProfessor(offerings);
    expect(groups).toHaveLength(1);
    expect(groups[0].unassigned).toBe(true);
    expect(groups[0].hasPredicted).toBeFalsy();
  });

  it("does not add a predicted row when the prof already confirmedly teaches that term", () => {
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2271", [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: "ITI 1120",
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection("A00-LEC FullSess.", "LEC", ["Ann Bee"]),
                // Predicted to be Ann (already teaching) or Cy (not) this term.
                scheduleSection(
                  "B00-LEC FullSess.",
                  "LEC",
                  ["Staff"],
                  [
                    { name: "Ann Bee", legacyId: 1 },
                    { name: "Cy Dee", legacyId: 3 },
                  ],
                ),
              ],
            },
          },
        ]),
      ],
      new Map(),
    );
    const groups = groupOfferingsByProfessor(offerings);
    const ann = groups.find((g) => g.displayName === "Ann Bee");
    // Ann has a single confirmed offering — no duplicate predicted row.
    expect(ann?.offerings).toHaveLength(1);
    expect(ann?.offerings[0].predicted).toBeFalsy();
    // Cy still gets a predicted row.
    const cy = groups.find((g) => g.displayName === "Cy Dee");
    expect(cy?.offerings).toHaveLength(1);
    expect(cy?.offerings[0].predicted).toBe(true);
  });

  it("keeps unpredicted Staff sections in the unassigned group even when others are predicted", () => {
    // The ITI 1120 case: a prof confirmed on some sections, a Staff section
    // predicted to that same prof, and a Staff section with no guess at all.
    const offerings = buildScheduleOfferings(
      [
        scheduleData("2269", [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: "ITI 1120",
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {
              LEC: [
                scheduleSection("A00-LEC FullSess.", "LEC", ["Vida Dujmovic"]),
                scheduleSection(
                  "D00-LEC FullSess.",
                  "LEC",
                  ["Staff"],
                  [{ name: "Vida Dujmovic", legacyId: 1948393 }],
                ),
                scheduleSection("C00-LEC FullSess.", "LEC", ["Staff"]),
              ],
            },
          },
        ]),
      ],
      new Map(),
    );
    const groups = groupOfferingsByProfessor(offerings);
    // Vida appears once (confirmed, no badge); the no-guess C00 section keeps a
    // visible "unassigned" group instead of vanishing.
    const vida = groups.find((g) => g.displayName === "Vida Dujmovic");
    expect(vida?.offerings).toHaveLength(1);
    expect(vida?.offerings[0].predicted).toBeFalsy();
    expect(groups.some((g) => g.unassigned)).toBe(true);
  });

  it("collects predicted rows for the same prof across terms into one group", () => {
    const sectionWith = (section: string) =>
      scheduleSection(section, "LEC", ["Staff"], [{ name: "Ann Bee", legacyId: 1 }]);
    const course = (code: string): CourseSchedule => ({
      subject: "ITI",
      catalogNumber: "1120",
      courseCode: code,
      title: "Intro to Computing",
      timeZone: "America/Toronto",
      components: { LEC: [sectionWith("A00")] },
    });
    const offerings = buildScheduleOfferings(
      [scheduleData("2271", [course("ITI 1120")]), scheduleData("2275", [course("ITI 1120")])],
      new Map(),
    );
    expect(offerings.filter((o) => o.unassignedInstructor)).toHaveLength(2); // one per term

    const groups = groupOfferingsByProfessor(offerings);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Ann Bee");
    expect(groups[0].hasPredicted).toBe(true);
    expect(groups[0].offerings).toHaveLength(2); // one predicted row per term
  });

  it("reconciles a name-keyed confirmed offering with a legacyId-keyed prediction", () => {
    // Confirmed schedule row with no backfilled legacyId (name-keyed) ...
    const confirmed = sampleOffering({
      id: "confirmed",
      courseCode: "ITI 1120",
      professorName: "Vida Dujmovic",
      termId: 2269,
      distribution: {},
    });
    // ... and a same-term unassigned row predicted to the same person by legacyId.
    const predicted = sampleOffering({
      id: "predicted",
      courseCode: "ITI 1120",
      professorName: "",
      termId: 2269,
      distribution: {},
      unassignedInstructor: true,
      predictedInstructors: [{ name: "Vida Dujmovic", legacyId: 1948393 }],
    });
    const groups = groupOfferingsByProfessor([confirmed, predicted]);
    // One Vida group, no duplicate, and the prediction is suppressed (confirmed).
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Vida Dujmovic");
    expect(groups[0].offerings).toHaveLength(1);
    expect(groups[0].offerings[0].predicted).toBeFalsy();
    expect(groups[0].hasPredicted).toBeFalsy();
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

  it("backfills grade legacyId onto schedule rows so the professor groups into one entry", () => {
    const gradeOfferings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "grade",
        courseCode: "CSI 2110",
        professorName: "Miguel Garzon",
        legacyId: 42,
        termId: 2251,
        section: "A00",
      }),
    ];
    const scheduleOfferings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "sched",
        courseCode: "CSI 3104",
        professorName: "Miguel Garzon",
        termId: 2261,
        section: undefined,
        distribution: {},
      }),
    ];
    const merged = mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
    expect(merged.find((o) => o.id === "sched")?.legacyId).toBe(42);
    expect(groupOfferingsByProfessor(merged)).toHaveLength(1);
  });

  it("leaves schedule rows unmerged when a name maps to multiple legacyIds", () => {
    const gradeOfferings: ExploreOfferingFlat[] = [
      sampleOffering({ id: "g1", professorName: "John Smith", legacyId: 1, termId: 2251 }),
      sampleOffering({ id: "g2", professorName: "John Smith", legacyId: 2, termId: 2251 }),
    ];
    const scheduleOfferings: ExploreOfferingFlat[] = [
      sampleOffering({
        id: "sched",
        courseCode: "CSI 9999",
        professorName: "John Smith",
        termId: 2261,
        section: undefined,
        distribution: {},
      }),
    ];
    const merged = mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
    expect(merged.find((o) => o.id === "sched")?.legacyId).toBeUndefined();
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
