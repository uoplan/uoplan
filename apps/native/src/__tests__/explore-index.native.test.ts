import type { SchedulesData } from "@uoplan/core/dataTypes";

import {
  type AppDataBundle,
  buildExploreIndex,
  courseSpotlights,
  type ExploreCourseEntry,
  type ExploreIndex,
  type ExploreProfessorEntry,
  searchExplore,
} from "@/data/explore-index";

/** Build a small but realistic bundle covering every result type. */
function makeBundle(): AppDataBundle {
  // Two professors in the registry → refs 1 and 2.
  const professors = [
    {
      slug: "ada-lovelace",
      name: "Ada Lovelace",
      legacyIds: [],
      aliases: [],
      rating: 4.5,
      numRatings: 12,
    },
    { slug: "alan-turing", name: "Alan Turing", legacyIds: [], aliases: [] },
  ];

  const grades = {
    courses: [
      {
        code: "ITI 1120",
        sections: [
          {
            name: "Ada Lovelace",
            professorRef: 1,
            termId: 2265,
            distribution: { "A+": 30, B: 20, F: 50 },
          },
          { name: "Alan Turing", professorRef: 2, termId: 2261, distribution: { A: 40, C: 10 } },
        ],
      },
      {
        code: "MAT 1320",
        sections: [
          {
            name: "Ada Lovelace",
            professorRef: 1,
            termId: 2265,
            distribution: { "A+": 80, A: 20 },
          },
        ],
      },
    ],
  };

  const catalogue = {
    courses: [
      { code: "ITI 1120", title: "Intro to Computing", credits: 3, description: "" },
      { code: "MAT 1320", title: "Calculus I", credits: 3, description: "" },
    ],
    programs: [
      {
        title: "Computer Science",
        url: "https://x/cs",
        slug: "computer-science",
        requirements: [],
      },
      { title: "Mathematics", url: "https://x/math", slug: "mathematics", requirements: [] },
    ],
  };

  const disciplines = [
    { code: "ITI", name: "Computer Science", facultyId: "engineering" },
    { code: "MAT", name: "Mathematics", facultyId: "science" },
  ];
  const faculties = [
    { id: "engineering", name: "Faculty of Engineering" },
    { id: "science", name: "Faculty of Science" },
  ];

  return {
    terms: [{ termId: "2265", name: "Fall 2026" }],
    disciplines,
    faculties,
    grades,
    catalogue,
    professors,
    ratings: {},
  } as unknown as AppDataBundle;
}

describe("buildExploreIndex", () => {
  const index = buildExploreIndex(makeBundle());

  it("merges grade distributions per course across offerings", () => {
    const iti = index.courses.find((c) => c.code === "ITI 1120");
    expect(iti?.title).toBe("Intro to Computing");
    // A+30 + B20 + F50 + A40 + C10 graded = 150
    expect(iti?.graded).toBe(150);
    expect(iti?.failRate).toBeCloseTo(50 / 150, 5);
    expect(iti?.gradeViz).not.toBeNull();
  });

  it("rolls grade viz up to disciplines and faculties", () => {
    const cs = index.disciplines.find((d) => d.code === "ITI");
    expect(cs?.courseCount).toBe(1);
    expect(cs?.gradeViz).not.toBeNull();

    const eng = index.faculties.find((f) => f.id === "engineering");
    expect(eng?.disciplineCount).toBe(1);
    expect(eng?.gradeViz).not.toBeNull();
  });

  it("exposes programs from the catalogue", () => {
    expect(index.programs.map((p) => p.title)).toEqual(["Computer Science", "Mathematics"]);
  });

  it("aggregates per-professor grade distributions via professorRef", () => {
    const ada = index.professors.find((p) => p.slug === "ada-lovelace");
    // Ada taught ITI (A+30,B20,F50) + MAT (A+80,A20) → graded 200
    expect(ada?.graded).toBe(200);
    expect(ada?.rating).toBe(4.5);
    expect(ada?.gradeViz).not.toBeNull();
  });
});

/** A SchedulesData fixture offering one course (taught by professorRef) in a term. */
function makeSchedules(termId: string, courseCode: string, professorRef: number): SchedulesData {
  return {
    termId,
    schedules: [
      {
        subject: courseCode.split(" ")[0]!,
        catalogNumber: courseCode.split(" ")[1]!,
        courseCode,
        title: null,
        timeZone: "America/Toronto",
        components: {
          LEC: [
            {
              section: "A00",
              sectionCode: null,
              component: "LEC",
              session: null,
              times: [
                {
                  day: "Mon",
                  startMinutes: 540,
                  endMinutes: 600,
                  virtual: false,
                  instructor: null,
                  professorRef,
                  meetingDates: null,
                },
              ],
              status: "open",
            },
          ],
        },
      },
    ],
  } as unknown as SchedulesData;
}

describe("buildExploreIndex term offerings (schedules-derived)", () => {
  // ITI 1120 was only ever *graded* in past terms (2261/2265), but the schedules
  // offer it in the upcoming registration term 2269 (the explore term filter uses
  // registration terms from terms.pb, so it must match offerings, not grade history).
  const schedulesByTerm = new Map<string, SchedulesData>([
    ["2269", makeSchedules("2269", "ITI 1120", 1)],
  ]);
  const index = buildExploreIndex(makeBundle(), schedulesByTerm);

  it("derives course term ids from schedule offerings, not grade history", () => {
    const iti = index.courses.find((c) => c.code === "ITI 1120");
    expect(iti?.termIds).toEqual(["2269"]);
    const mat = index.courses.find((c) => c.code === "MAT 1320");
    expect(mat?.termIds).toEqual([]);
  });

  it("derives professor term ids from schedule offerings", () => {
    const ada = index.professors.find((p) => p.slug === "ada-lovelace");
    expect(ada?.termIds).toEqual(["2269"]);
  });

  it("filters explore results by the upcoming registration term", () => {
    const results = searchExplore(index, "   ", { termId: "2269" });
    expect(results.courses.map((c) => c.code)).toEqual(["ITI 1120"]);
    expect(results.professors.map((p) => p.name)).toEqual(["Ada Lovelace"]);
  });
});

describe("searchExplore", () => {
  const index = buildExploreIndex(makeBundle());

  it("returns matching results across every section", () => {
    const results = searchExplore(index, "comp");
    expect(results.disciplines.some((d) => d.name === "Computer Science")).toBe(true);
    expect(results.programs.some((p) => p.title === "Computer Science")).toBe(true);
  });

  it("matches courses by code", () => {
    const results = searchExplore(index, "ITI");
    expect(results.courses.map((c) => c.code)).toContain("ITI 1120");
  });

  it("matches professors by name", () => {
    const results = searchExplore(index, "turing");
    expect(results.professors.map((p) => p.name)).toContain("Alan Turing");
  });

  it("returns empty sections for a blank query", () => {
    const results = searchExplore(index, "   ");
    expect(results.courses).toEqual([]);
    expect(results.professors).toEqual([]);
  });

  it("keeps the existing numeric limit argument working", () => {
    const filterIndex = makeFilterIndex();
    const results = searchExplore(filterIndex, "course", 2);
    expect(results.courses).toHaveLength(2);
  });

  it("filters course results by level, language, and discipline", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "course", { levels: [2000] }).courses.map((c) => c.code),
    ).toEqual(["CSI 2510"]);
    expect(
      searchExplore(filterIndex, "course", { languages: ["fr"] }).courses.map((c) => c.code),
    ).toEqual(["CSI 2510"]);
    expect(
      searchExplore(filterIndex, "course", { disciplines: ["MAT"] }).courses.map((c) => c.code),
    ).toEqual(["MAT 3120"]);
  });

  it("shows filtered courses for a blank query when a course filter is active", () => {
    const filterIndex = makeFilterIndex();

    const results = searchExplore(filterIndex, "   ", { levels: [2000] });

    expect(results.courses.map((c) => c.code)).toEqual(["CSI 2510"]);
    expect(results.professors).toEqual([]);
  });

  it("filters courses by difficulty buckets", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "course", { difficulty: "easy" }).courses.map((c) => c.code),
    ).toEqual(["ITI 1120"]);
    expect(
      searchExplore(filterIndex, "course", { difficulty: "moderate" }).courses.map((c) => c.code),
    ).toEqual(["CSI 2510"]);
    expect(
      searchExplore(filterIndex, "course", { difficulty: "tough" }).courses.map((c) => c.code),
    ).toEqual(["MAT 3120"]);
  });

  it("filters professors by minimum rating", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "   ", { minRating: 4 }).professors.map((p) => p.name),
    ).toEqual(["Ada Lovelace"]);
  });

  it("filters courses and professors by feedback when sentiment data is present", () => {
    const filterIndex = makeFilterIndex();
    const results = searchExplore(filterIndex, "   ", {
      minFeedback: 4,
      courseSentimentByNorm: new Map([
        ["ITI 1120", 4.5],
        ["CSI 2510", 3.2],
        ["MAT 3120", 4],
      ]),
      professorSentimentByName: new Map([
        ["Ada Lovelace", 4.8],
        ["Alan Turing", 3.1],
      ]),
    });

    expect(results.courses.map((c) => c.code)).toEqual(["ITI 1120", "MAT 3120"]);
    expect(results.professors.map((p) => p.name)).toEqual(["Ada Lovelace"]);
  });

  it("skips feedback filtering while sentiment data is unavailable", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "   ", {
        minFeedback: 4,
        courseSentimentByNorm: null,
        professorSentimentByName: null,
      }).courses.map((c) => c.code),
    ).toEqual(["ITI 1120", "CSI 2510", "MAT 3120"]);
  });

  it("filters course and professor groups by term", () => {
    const filterIndex = makeFilterIndex();
    const results = searchExplore(filterIndex, "   ", { termId: "2265" });

    expect(results.courses.map((c) => c.code)).toEqual(["ITI 1120", "MAT 3120"]);
    expect(results.professors.map((p) => p.name)).toEqual(["Ada Lovelace"]);
  });

  it("filters requirement candidates and excludes completed courses supplied by the caller", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "course", {
        contributesToRequirements: true,
        requirementCandidateSet: new Set(["CSI 2510"]),
      }).courses.map((c) => c.code),
    ).toEqual(["CSI 2510"]);
  });

  it("sorts course and professor results with web defaults", () => {
    const filterIndex = makeFilterIndex();

    expect(
      searchExplore(filterIndex, "course", { sortKey: "grade", sortDir: "desc" }).courses.map(
        (c) => c.code,
      ),
    ).toEqual(["ITI 1120", "CSI 2510", "MAT 3120"]);
    expect(
      searchExplore(filterIndex, "a", {
        sortKey: "rating",
        sortDir: "desc",
      }).professors.map((p) => p.name),
    ).toEqual(["Ada Lovelace", "Alan Turing"]);
  });
});

function makeFilterIndex(): ExploreIndex {
  const course = (
    code: string,
    title: string,
    discipline: string,
    gpa: number | null,
    termIds: string[],
  ): ExploreCourseEntry => ({
    code,
    title,
    discipline,
    distribution: {},
    gradeViz: null,
    gpa,
    graded: 0,
    failRate: 0,
    termIds,
  });
  const professor = (
    slug: string,
    name: string,
    rating: number | undefined,
    termIds: string[],
  ): ExploreProfessorEntry => ({
    slug,
    name,
    rating,
    numRatings: rating == null ? undefined : 10,
    graded: 0,
    gpa: null,
    gradeViz: null,
    termIds,
    disciplines: ["ITI"],
  });

  return {
    courses: [
      course("ITI 1120", "Intro course", "ITI", 9.2, ["2265"]),
      course("CSI 2510", "Algorithms course", "CSI", 8, ["2261"]),
      course("MAT 3120", "Algebra course", "MAT", 6.8, ["2265"]),
    ],
    professors: [
      professor("ada-lovelace", "Ada Lovelace", 4.5, ["2265"]),
      professor("alan-turing", "Alan Turing", 3.2, ["2261"]),
    ],
    disciplines: [],
    faculties: [],
    programs: [],
  };
}

describe("courseSpotlights", () => {
  it("ranks eligible courses by gpa, fail rate, and graded volume", () => {
    const index = buildExploreIndex(makeBundle());
    const spotlights = courseSpotlights(index);
    expect(spotlights.map((s) => s.id)).toEqual(["gpa", "fail", "graded"]);
    // Both courses clear the 40-graded threshold.
    const mostGraded = spotlights.find((s) => s.id === "graded");
    expect(mostGraded?.courses[0]?.code).toBe("ITI 1120"); // 150 graded vs MAT's 100
  });
});
