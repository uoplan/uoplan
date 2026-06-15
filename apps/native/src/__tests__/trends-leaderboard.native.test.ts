import { buildTrendsLeaderboard, type TrendsLeaderboardSort } from "@/data/trends-leaderboard";

type Grades = Parameters<typeof buildTrendsLeaderboard>[0];

const grades = {
  courses: [
    {
      code: "PSY 1100",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2179,
          section: "",
          distribution: { "A+": 12, F: 48 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 54, F: 6 },
        },
      ],
    },
    {
      code: "PSY 2100",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2179,
          section: "",
          distribution: { "A+": 30, F: 30 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 42, F: 18 },
        },
      ],
    },
    {
      code: "PSY 3100",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 36, F: 24 },
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
          distribution: { "A+": 30, F: 30 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 42, F: 18 },
        },
      ],
    },
    {
      code: "HIS 1111",
      sections: [
        {
          name: "A",
          professorRef: 0,
          termId: 2179,
          section: "",
          distribution: { "A+": 48, F: 12 },
        },
        {
          name: "B",
          professorRef: 0,
          termId: 2199,
          section: "",
          distribution: { "A+": 24, F: 36 },
        },
      ],
    },
  ],
} as unknown as Grades;

const disciplineNames = new Map([
  ["PSY", "Psychology"],
  ["MAT", "Mathematics"],
  ["HIS", "History"],
]);

const courseTitles = new Map([
  ["PSY 1100", "Introduction to psychology"],
  ["PSY 2100", "Research methods"],
  ["PSY 3100", "Single-term seminar"],
]);

describe("trends-leaderboard view-model", () => {
  it("ranks university-wide disciplines by biggest GPA rise by default", () => {
    const rows = buildTrendsLeaderboard(grades, {
      disciplineNameByCode: disciplineNames,
      limit: 2,
    });

    expect(rows.map((row) => row.label)).toEqual(["PSY", "MAT"]);
    expect(rows[0]).toMatchObject({
      key: "PSY",
      name: "Psychology",
      scope: "discipline",
      firstYear: 2017,
      lastYear: 2019,
    });
    expect(rows[0]?.gpaDelta).toBeGreaterThan(rows[1]?.gpaDelta ?? 0);
  });

  it.each([
    ["easy", ["PSY", "MAT", "HIS"]],
    ["hard", ["HIS", "MAT", "PSY"]],
  ] satisfies Array<[TrendsLeaderboardSort, string[]]>)(
    "sorts disciplines in %s mode",
    (sort, expectedOrder) => {
      const rows = buildTrendsLeaderboard(grades, {
        disciplineNameByCode: disciplineNames,
        sort,
        limit: 3,
      });

      expect(rows.map((row) => row.label)).toEqual(expectedOrder);
    },
  );

  it("switches to per-course rows when a discipline is selected", () => {
    const rows = buildTrendsLeaderboard(grades, {
      discipline: "PSY",
      courseTitleByCode: courseTitles,
    });

    expect(rows.map((row) => row.label)).toEqual(["PSY 1100", "PSY 2100", "PSY 3100"]);
    expect(rows.every((row) => row.scope === "course")).toBe(true);
    expect(rows[0]).toMatchObject({
      key: "PSY 1100",
      name: "Introduction to psychology",
    });
    expect(rows[2]?.gpaDelta).toBeNull();
  });
});
