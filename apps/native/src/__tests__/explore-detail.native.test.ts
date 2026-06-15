import type { AppDataBundle, ExploreIndex } from "@/data/explore-index";
import { buildExploreIndex } from "@/data/explore-index";
import {
  courseDetail,
  defaultCourseSectionSelection,
  disciplineCourseProfessors,
  disciplineDetail,
  facultyDetail,
  professorDetail,
  sectionOverlapsSelection,
  selectedCourseScheduleEvents,
} from "@/data/explore-detail";
import type { ComponentSection, CourseSchedule } from "@uoplan/core/dataTypes";
import { buildAliasGroups } from "@uoplan/core/courseAlias";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

// A tiny fixture spanning one faculty, two disciplines, three courses and two
// professors so each detail selector resolves a non-trivial related-entity list.
function makeBundle(): AppDataBundle {
  return {
    terms: [],
    faculties: [{ id: "science", name: "Faculty of Science" }],
    disciplines: [
      { code: "ITI", name: "Information Technology", facultyId: "science" },
      { code: "MAT", name: "Mathematics", facultyId: "science" },
    ],
    catalogue: {
      courses: [
        { code: "ITI 1120", title: "Intro to Computing II", credits: 3, description: "" },
        { code: "ITI 1121", title: "Data Structures", credits: 3, description: "" },
        { code: "MAT 1320", title: "Calculus I", credits: 3, description: "" },
      ],
      programs: [],
    },
    professors: [
      { slug: "alice-smith", name: "Alice Smith", legacyIds: [], aliases: [], rating: 4.5 },
      { slug: "bob-jones", name: "Bob Jones", legacyIds: [], aliases: [] },
    ],
    ratings: { "Bob Jones": { rating: 3.2, numRatings: 8 } },
    grades: {
      courses: [
        {
          code: "ITI 1120",
          sections: [
            {
              name: "Alice Smith",
              professorRef: 1,
              termId: 2199,
              section: "",
              distribution: { "A+": 30, B: 40, F: 20 },
            },
            {
              name: "Bob Jones",
              professorRef: 2,
              termId: 2191,
              section: "",
              distribution: { "A+": 10, B: 20, F: 30 },
            },
            {
              termId: 2199,
              section: "C00",
              distribution: { A: 12 },
            },
          ],
        },
        {
          code: "ITI 1121",
          sections: [
            {
              name: "Alice Smith",
              professorRef: 1,
              termId: 2199,
              section: "",
              distribution: { "A+": 20, B: 30, F: 10 },
            },
          ],
        },
        {
          code: "MAT 1320",
          sections: [
            {
              name: "Bob Jones",
              professorRef: 2,
              termId: 2199,
              section: "",
              distribution: { "A+": 5, B: 25, F: 40 },
            },
          ],
        },
      ],
    },
  } as unknown as AppDataBundle;
}

let bundle: AppDataBundle;
let index: ExploreIndex;

beforeEach(() => {
  bundle = makeBundle();
  index = buildExploreIndex(bundle);
});

function makeSection(
  component: string,
  sectionCode: string,
  startMinutes: number | null,
  endMinutes: number | null,
  instructor: string | null,
  distribution?: Record<string, number>,
): ComponentSection {
  return {
    section: sectionCode,
    sectionCode,
    component,
    session: null,
    status: "Open",
    ...(distribution ? { distribution } : {}),
    predictedInstructors:
      instructor == null ? [{ name: "Dana Doe", legacyId: 42, professorRef: 7 }] : undefined,
    times:
      startMinutes == null || endMinutes == null
        ? []
        : [
            {
              day: "Mo",
              startMinutes,
              endMinutes,
              virtual: false,
              instructor,
              meetingDates: ["2026-09-01", "2026-12-08"],
            },
          ],
  };
}

function makeSchedule(): CourseSchedule {
  return {
    subject: "ITI",
    catalogNumber: "1120",
    courseCode: normalizeCourseCode("ITI 1120"),
    title: "Intro to Computing II",
    timeZone: "America/Toronto",
    components: {
      LEC: [
        makeSection("LEC", "A00", 9 * 60, 10 * 60, "Alice Smith", { A: 8, F: 2 }),
        makeSection("LEC", "B00", 11 * 60, 12 * 60, "Bob Jones", { A: 12, F: 2 }),
      ],
      DGD: [makeSection("DGD", "D1", 9 * 60 + 30, 10 * 60 + 30, null)],
    },
  };
}

describe("course schedule selection helpers", () => {
  it("defaults to the first conflict-free section combo", () => {
    const selection = defaultCourseSectionSelection(makeSchedule());

    expect(selection).toEqual({ DGD: "D1", LEC: "B00" });
  });

  it("flags a section that overlaps the current selections in other components", () => {
    const course = makeSchedule();
    const selection = { DGD: "D1", LEC: "B00" };
    const conflictingLecture = course.components.LEC?.[0];
    const selectedLecture = course.components.LEC?.[1];

    expect(conflictingLecture).toBeDefined();
    expect(selectedLecture).toBeDefined();
    expect(sectionOverlapsSelection(course, selection, "LEC", conflictingLecture!)).toBe(true);
    expect(sectionOverlapsSelection(course, selection, "LEC", selectedLecture!)).toBe(false);
  });

  it("builds preview events only for the selected sections", () => {
    const course = makeSchedule();
    const events = selectedCourseScheduleEvents(course, { DGD: "D1", LEC: "B00" }, { A: 10, F: 1 });

    expect(events.map((event) => event.componentSection)).toEqual(["DGD - D1", "LEC - B00"]);
    expect(events.some((event) => event.componentSection.includes("A00"))).toBe(false);
    expect(events[0]?.predictedInstructors?.map((instructor) => instructor.name)).toEqual([
      "Dana Doe",
    ]);
    expect(events[0]?.gradeViz?.total).toBe(11);
    expect(events[1]?.gradeViz?.total).toBe(14);
  });
});

describe("courseDetail", () => {
  it("resolves a course with the professors who taught it", () => {
    const detail = courseDetail(bundle, index, "ITI 1120");
    expect(detail).not.toBeNull();
    expect(detail?.course.title).toBe("Intro to Computing II");
    const names = detail?.professors.map((p) => p.name);
    expect(names).toContain("Alice Smith");
    expect(names).toContain("Bob Jones");
    expect(names).toContain("No professor assigned");
    // Each related professor carries a slug (for navigation) + grade-viz.
    for (const prof of detail?.professors ?? []) {
      if (prof.name !== "No professor assigned") expect(prof.slug).toBeTruthy();
      expect(prof.gradeViz).not.toBeNull();
    }
    const unassigned = detail?.professors.find((p) => p.name === "No professor assigned");
    expect(unassigned).toMatchObject({
      slug: undefined,
      rating: null,
      graded: 12,
    });
  });

  it("carries a professor rating (registry value, or ratings-map fallback)", () => {
    const detail = courseDetail(bundle, index, "ITI 1120");
    const alice = detail?.professors.find((p) => p.name === "Alice Smith");
    const bob = detail?.professors.find((p) => p.name === "Bob Jones");
    expect(alice?.rating).toBe(4.5); // direct from the professor registry entry
    expect(bob?.rating).toBe(3.2); // falls back to the ratings map (keyed by normalized name)
  });

  it("returns null for an unknown course", () => {
    expect(courseDetail(bundle, index, "ZZZ 9999")).toBeNull();
  });

  it("has no alias siblings and no merge without alias groups", () => {
    const detail = courseDetail(bundle, index, "ITI 1120");
    expect(detail?.aliasCodes).toEqual([]);
  });

  it("pools grades across alias members and lists the sibling code", () => {
    // Treat ITI 1120 and ITI 1121 as cross-listed (one course).
    const aliasGroups = buildAliasGroups({
      courses: [
        {
          code: normalizeCourseCode("ITI 1120"),
          title: "Intro to Computing II",
          credits: 3,
          description: "",
          aliases: [normalizeCourseCode("ITI 1121")],
        },
        {
          code: normalizeCourseCode("ITI 1121"),
          title: "Data Structures",
          credits: 3,
          description: "",
        },
      ],
      programs: [],
    });

    const merged = courseDetail(bundle, index, "ITI 1120", aliasGroups);
    expect(merged?.aliasCodes).toContain("ITI 1121");

    // Alice taught both ITI 1120 and ITI 1121, so her merged graded mass exceeds
    // the standalone (ITI 1120-only) count.
    const solo =
      courseDetail(bundle, index, "ITI 1120")?.professors.find((p) => p.name === "Alice Smith")
        ?.graded ?? 0;
    const aliceMerged = merged?.professors.find((p) => p.name === "Alice Smith")?.graded ?? 0;
    expect(aliceMerged).toBeGreaterThan(solo);
  });
});

describe("professorDetail", () => {
  it("resolves a professor with the courses they taught", () => {
    const detail = professorDetail(bundle, index, "alice-smith");
    expect(detail).not.toBeNull();
    expect(detail?.professor.name).toBe("Alice Smith");
    const codes = detail?.courses.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["ITI 1120", "ITI 1121"]));
    expect(codes).not.toContain("MAT 1320");
  });

  it("returns null for an unknown professor", () => {
    expect(professorDetail(bundle, index, "nobody")).toBeNull();
  });
});

describe("section offerings", () => {
  it("courseDetail carries one offering per term/section the professor taught", () => {
    const detail = courseDetail(bundle, index, "ITI 1120");
    const alice = detail?.professors.find((p) => p.name === "Alice Smith");
    expect(alice?.offerings).toHaveLength(1);
    expect(alice?.offerings?.[0]).toMatchObject({ termId: 2199, graded: 90 });
    expect(alice?.offerings?.[0]?.gradeViz).not.toBeNull();
  });

  it("professorDetail carries per-course section offerings", () => {
    const detail = professorDetail(bundle, index, "alice-smith");
    const iti1120 = detail?.courses.find((c) => c.code === "ITI 1120");
    expect(iti1120?.offerings).toHaveLength(1);
    expect(iti1120?.offerings?.[0]).toMatchObject({ termId: 2199, graded: 90 });
  });

  it("pools records sharing a term+section and sorts newest term first", () => {
    const multi = makeBundle();
    // Alice taught ITI 1120 across two terms + two sections within 2199.
    multi.grades.courses[0]!.sections = [
      { name: "Alice Smith", professorRef: 1, termId: 2199, section: "A", distribution: { A: 10 } },
      { name: "Alice Smith", professorRef: 1, termId: 2199, section: "A", distribution: { B: 5 } },
      { name: "Alice Smith", professorRef: 1, termId: 2199, section: "B", distribution: { A: 4 } },
      { name: "Alice Smith", professorRef: 1, termId: 2189, section: "A", distribution: { F: 3 } },
    ];
    const idx = buildExploreIndex(multi);
    const alice = courseDetail(multi, idx, "ITI 1120")?.professors.find(
      (p) => p.name === "Alice Smith",
    );

    expect(alice?.offerings?.map((o) => `${o.termId}|${o.section ?? ""}`)).toEqual([
      "2199|A",
      "2199|B",
      "2189|A",
    ]);
    // The two (2199, A) records merge: 10 + 5 graded.
    expect(alice?.offerings?.[0]?.graded).toBe(15);
  });
});

describe("disciplineDetail", () => {
  it("resolves a discipline with its courses (case-insensitive code)", () => {
    const detail = disciplineDetail(index, "iti");
    expect(detail).not.toBeNull();
    expect(detail?.discipline.name).toBe("Information Technology");
    const codes = detail?.courses.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["ITI 1120", "ITI 1121"]));
    expect(codes).not.toContain("MAT 1320");
  });

  it("returns null for an unknown discipline", () => {
    expect(disciplineDetail(index, "ZZZ")).toBeNull();
  });
});

describe("facultyDetail", () => {
  it("resolves a faculty with its disciplines", () => {
    const detail = facultyDetail(index, "science");
    expect(detail).not.toBeNull();
    const codes = detail?.disciplines.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(["ITI", "MAT"]));
  });

  it("returns null for an unknown faculty", () => {
    expect(facultyDetail(index, "nope")).toBeNull();
  });
});

describe("disciplineCourseProfessors", () => {
  it("maps every course in a discipline to its professor breakdown", () => {
    const map = disciplineCourseProfessors(bundle, "ITI");
    expect([...map.keys()].sort()).toEqual(["ITI 1120", "ITI 1121"]);
    // ITI 1120 was taught by both professors and has one nameless section; ITI 1121 only by Alice.
    expect(
      map
        .get("ITI 1120")
        ?.map((p) => p.name)
        .sort(),
    ).toEqual(["Alice Smith", "Bob Jones", "No professor assigned"]);
    expect(map.get("ITI 1121")?.map((p) => p.name)).toEqual(["Alice Smith"]);
    // Excludes courses from other disciplines.
    expect(map.has("MAT 1320")).toBe(false);
  });

  it("sorts professors by graded volume and carries slug + grade-viz", () => {
    const map = disciplineCourseProfessors(bundle, "ITI");
    const profs = map.get("ITI 1120") ?? [];
    // Alice (90 graded) ranks above Bob (60 graded).
    expect(profs[0]?.name).toBe("Alice Smith");
    for (const prof of profs) {
      if (prof.name !== "No professor assigned") expect(prof.slug).toBeTruthy();
      expect(prof.gradeViz).not.toBeNull();
    }
  });

  it("is case-insensitive on the discipline code", () => {
    expect([...disciplineCourseProfessors(bundle, "iti").keys()].sort()).toEqual([
      "ITI 1120",
      "ITI 1121",
    ]);
  });
});
