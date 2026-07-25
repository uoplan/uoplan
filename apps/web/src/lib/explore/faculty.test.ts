import { describe, expect, it } from "vitest";
import { unsafeBrand } from "@uoplan/core";
import type { Discipline, Faculty, FacultyId } from "@uoplan/core";
import {
  buildFacultyIndexRows,
  disciplinesForFaculty,
  facultyForDisciplineCode,
  facultyIndexRowFor,
  filterFaculties,
  localizeFacultyName,
} from "./faculty";

const fid = (value: string): FacultyId => unsafeBrand<FacultyId>(value);

const FACULTIES: Faculty[] = [
  {
    id: fid("health-sciences"),
    name: "Faculty of Health Sciences",
    nameFr: "Faculté des sciences de la santé",
  },
  { id: fid("engineering"), name: "Faculty of Engineering", nameFr: "Faculté de génie" },
  { id: fid("management"), name: "Telfer School of Management", nameFr: "École de gestion Telfer" },
];

const DISCIPLINES: Discipline[] = [
  { code: "HSS", name: "Health Sciences", facultyId: fid("health-sciences") },
  { code: "NSG", name: "Nursing", facultyId: fid("health-sciences") },
  { code: "APA", name: "Human Kinetics", facultyId: fid("health-sciences") },
  { code: "CEG", name: "Computer Engineering", facultyId: fid("engineering") },
  { code: "ZZZ", name: "Empty Discipline", facultyId: fid("health-sciences") },
];

describe("filterFaculties", () => {
  it("returns [] for a blank query", () => {
    expect(filterFaculties(FACULTIES, "  ", 6)).toEqual([]);
  });

  it("returns [] when the registry is absent", () => {
    expect(filterFaculties(null, "health", 6)).toEqual([]);
  });

  it("matches on the English name (case-insensitive)", () => {
    const result = filterFaculties(FACULTIES, "HEALTH", 6);
    expect(result.map((f) => f.id)).toEqual([fid("health-sciences")]);
  });

  it("matches on the id slug", () => {
    const result = filterFaculties(FACULTIES, "management", 6);
    expect(result.map((f) => f.id)).toEqual([fid("management")]);
  });

  it("matches on the French name", () => {
    const result = filterFaculties(FACULTIES, "génie", 6);
    expect(result.map((f) => f.id)).toEqual([fid("engineering")]);
  });

  it("caps the number of results at the limit", () => {
    expect(filterFaculties(FACULTIES, "faculté", 1)).toHaveLength(1);
  });
});

describe("disciplinesForFaculty", () => {
  const counts = new Map<string, number>([
    ["HSS", 12],
    ["NSG", 8],
    ["APA", 5],
    ["CEG", 20],
    ["ZZZ", 0],
  ]);

  it("returns [] when disciplines are absent", () => {
    expect(disciplinesForFaculty(null, "health-sciences", counts)).toEqual([]);
  });

  it("groups a faculty's disciplines, drops 0-course ones, and sorts by code", () => {
    const result = disciplinesForFaculty(DISCIPLINES, "health-sciences", counts);
    expect(result.map((e) => e.discipline.code)).toEqual(["APA", "HSS", "NSG"]);
    expect(result.map((e) => e.courseCount)).toEqual([5, 12, 8]);
  });

  it("only includes disciplines owned by the faculty", () => {
    const result = disciplinesForFaculty(DISCIPLINES, "engineering", counts);
    expect(result.map((e) => e.discipline.code)).toEqual(["CEG"]);
  });
});

const COUNTS = new Map<string, number>([
  ["HSS", 12],
  ["NSG", 8],
  ["APA", 5],
  ["CEG", 20],
  ["ZZZ", 0],
]);

describe("facultyIndexRowFor", () => {
  it("aggregates prefixes and counts, skipping 0-course disciplines", () => {
    const row = facultyIndexRowFor(FACULTIES[0]!, DISCIPLINES, COUNTS);
    expect([...row.prefixes].sort()).toEqual(["APA", "HSS", "NSG"]);
    expect(row.disciplineCount).toBe(3);
    expect(row.courseCount).toBe(25);
  });

  it("returns an empty row when disciplines are absent", () => {
    const row = facultyIndexRowFor(FACULTIES[0]!, null, COUNTS);
    expect(row.prefixes.size).toBe(0);
    expect(row.disciplineCount).toBe(0);
    expect(row.courseCount).toBe(0);
  });
});

describe("buildFacultyIndexRows", () => {
  it("returns [] when the registry is absent", () => {
    expect(buildFacultyIndexRows(null, DISCIPLINES, COUNTS, "en")).toEqual([]);
  });

  it("drops faculties with no course-bearing disciplines and sorts by English name", () => {
    const rows = buildFacultyIndexRows(FACULTIES, DISCIPLINES, COUNTS, "en");
    expect(rows.map((r) => r.faculty.id)).toEqual([fid("engineering"), fid("health-sciences")]);
    expect(rows.map((r) => r.courseCount)).toEqual([20, 25]);
  });

  it("sorts by the localized name, so fr-CA can order differently than en", () => {
    const arts: Faculty = { id: fid("arts"), name: "Faculty of Arts", nameFr: "Faculté des arts" };
    const engineering = FACULTIES[1]!; // Faculty of Engineering / Faculté de génie
    const disciplines: Discipline[] = [
      { code: "ART", name: "Arts", facultyId: fid("arts") },
      ...DISCIPLINES,
    ];
    const counts = new Map(COUNTS).set("ART", 4);

    expect(
      buildFacultyIndexRows([engineering, arts], disciplines, counts, "en").map(
        (r) => r.faculty.id,
      ),
    ).toEqual([fid("arts"), fid("engineering")]);
    expect(
      buildFacultyIndexRows([arts, engineering], disciplines, counts, "fr-CA").map(
        (r) => r.faculty.id,
      ),
    ).toEqual([fid("engineering"), fid("arts")]);
  });
});

describe("facultyForDisciplineCode", () => {
  it("resolves the owning faculty for a discipline code", () => {
    expect(facultyForDisciplineCode(DISCIPLINES, FACULTIES, "nsg")?.id).toBe(
      fid("health-sciences"),
    );
  });

  it("returns null when the discipline is unknown", () => {
    expect(facultyForDisciplineCode(DISCIPLINES, FACULTIES, "xyz")).toBeNull();
  });
});

describe("localizeFacultyName", () => {
  const faculty = FACULTIES[0]!;

  it("prefers the French name for fr locales", () => {
    expect(localizeFacultyName(faculty, "fr-CA")).toBe("Faculté des sciences de la santé");
  });

  it("falls back to English otherwise", () => {
    expect(localizeFacultyName(faculty, "en")).toBe("Faculty of Health Sciences");
  });
});
