import { describe, expect, it } from "vitest";
import type { GradeVizData } from "@uoplan/core";
import type { ExploreCourseSearchEntry, ExploreProfessorSearchEntry } from "./gradesSearch";
import {
  EMPTY_FILTERS,
  compareCourseEntries,
  compareProfessorEntries,
  filterCourseEntries,
  filterProfessorEntries,
  getCourseDiscipline,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
  type ExploreFilterState,
} from "./exploreFilters";

function makeGradeViz(entries: Array<{ grade: string; count: number }>): GradeVizData {
  return {
    total: entries.reduce((sum, entry) => sum + entry.count, 0),
    passingPercent: 0.8,
    buckets: [],
    histogram: entries.map((entry) => ({
      grade: entry.grade,
      count: entry.count,
      bucketId: "green",
      color: "#5a9e7a",
    })),
  };
}

function makeCourseEntry(partial: Partial<ExploreCourseSearchEntry>): ExploreCourseSearchEntry {
  return {
    normCode: partial.normCode ?? "csi1100",
    courseCode: partial.courseCode ?? "CSI 1100",
    courseTitle: partial.courseTitle ?? "Intro",
    fuseText: partial.fuseText ?? "csi 1100 intro",
    gradeViz: partial.gradeViz ?? null,
    level: partial.level ?? 1000,
    language: partial.language ?? "en",
    maxProfessorRating: partial.maxProfessorRating ?? null,
    componentId: partial.componentId ?? partial.normCode ?? "csi1100",
  };
}

function makeProfessorEntry(
  partial: Partial<ExploreProfessorSearchEntry>,
): ExploreProfessorSearchEntry {
  return {
    groupId: partial.groupId ?? "prof-1",
    legacyId: partial.legacyId,
    displayName: partial.displayName ?? "Prof One",
    searchText: partial.searchText ?? "prof one",
    uniqueCourseCount: partial.uniqueCourseCount ?? 2,
    disciplines: partial.disciplines ?? [],
    gradeViz: partial.gradeViz ?? null,
    maxRating: partial.maxRating ?? null,
  };
}

describe("parseExploreFiltersSearch", () => {
  it("parses filters and sort from search params", () => {
    const parsed = parseExploreFiltersSearch({
      levels: "1000,2000,9000",
      langs: "en,fr,es",
      disc: "bio, CSI ,bio",
      difficulty: "moderate",
      minRating: "3.5",
      sort: "courseCode",
      dir: "asc",
    });

    expect(parsed.levels).toEqual([1000, 2000]);
    expect(parsed.languages).toEqual(["en", "fr"]);
    expect(parsed.disciplines).toEqual(["BIO", "CSI"]);
    expect(parsed.difficulty).toBe("moderate");
    expect(parsed.minRating).toBe(3.5);
    expect(parsed.sortKey).toBe("courseCode");
    expect(parsed.sortDir).toBe("asc");
  });

  it("falls back to defaults on invalid values", () => {
    const parsed = parseExploreFiltersSearch({
      levels: "9000,foo",
      langs: "es",
      difficulty: "hard",
      minRating: "nope",
      sort: "unknown",
      dir: "up",
    });

    expect(parsed).toEqual(EMPTY_FILTERS);
  });

  it("defaults sort direction per sort key", () => {
    const parsed = parseExploreFiltersSearch({ sort: "avgGrade" });
    expect(parsed.sortKey).toBe("avgGrade");
    expect(parsed.sortDir).toBe("desc");
  });
});

describe("serializeExploreFiltersSearch", () => {
  it("omits empty filters and relevance sort", () => {
    const params = serializeExploreFiltersSearch(EMPTY_FILTERS);
    expect(params).toEqual({});
  });

  it("serializes active filters and sort", () => {
    const filters: ExploreFilterState = {
      levels: [1000, 2000],
      languages: ["en"],
      disciplines: ["BIO", "CSI"],
      difficulty: "easy",
      minRating: 4,
      sortKey: "avgGrade",
      sortDir: "desc",
    };

    expect(serializeExploreFiltersSearch(filters)).toEqual({
      levels: "1000,2000",
      langs: "en",
      disc: "BIO,CSI",
      difficulty: "easy",
      minRating: "4",
      sort: "avgGrade",
      dir: "desc",
    });
  });
});

describe("compareCourseEntries", () => {
  it("orders by average grade with null handling", () => {
    const high = makeCourseEntry({
      normCode: "csi2100",
      gradeViz: makeGradeViz([{ grade: "A", count: 10 }]),
    });
    const low = makeCourseEntry({
      normCode: "csi1100",
      gradeViz: makeGradeViz([{ grade: "C", count: 10 }]),
    });
    const none = makeCourseEntry({ normCode: "csi3100", gradeViz: null });

    const desc = [low, none, high].sort((a, b) => compareCourseEntries(a, b, "avgGrade", "desc"));
    expect(desc.map((e) => e.normCode)).toEqual(["csi2100", "csi1100", "csi3100"]);

    const asc = [low, none, high].sort((a, b) => compareCourseEntries(a, b, "avgGrade", "asc"));
    expect(asc.map((e) => e.normCode)).toEqual(["csi3100", "csi1100", "csi2100"]);
  });

  it("orders by course code", () => {
    const a = makeCourseEntry({ normCode: "csi1100", courseCode: "CSI 1100" });
    const b = makeCourseEntry({ normCode: "csi2100", courseCode: "CSI 2100" });

    const asc = [b, a].sort((x, y) => compareCourseEntries(x, y, "courseCode", "asc"));
    expect(asc.map((e) => e.courseCode)).toEqual(["CSI 1100", "CSI 2100"]);

    const desc = [a, b].sort((x, y) => compareCourseEntries(x, y, "courseCode", "desc"));
    expect(desc.map((e) => e.courseCode)).toEqual(["CSI 2100", "CSI 1100"]);
  });
});

describe("filterCourseEntries difficulty (average CGPA)", () => {
  const easy = makeCourseEntry({
    normCode: "easy",
    gradeViz: makeGradeViz([{ grade: "A", count: 10 }]),
  });
  const moderate = makeCourseEntry({
    normCode: "moderate",
    gradeViz: makeGradeViz([{ grade: "A-", count: 10 }]),
  });
  const tough = makeCourseEntry({
    normCode: "tough",
    gradeViz: makeGradeViz([{ grade: "B+", count: 10 }]),
  });
  const noGrades = makeCourseEntry({ normCode: "none", gradeViz: null });
  const all = [easy, moderate, tough, noGrades];

  const withDifficulty = (difficulty: ExploreFilterState["difficulty"]): ExploreFilterState => ({
    ...EMPTY_FILTERS,
    difficulty,
  });

  it("buckets CGPA >= 9 as easy", () => {
    const result = filterCourseEntries(all, withDifficulty("easy"));
    expect(result.map((e) => e.normCode)).toEqual(["easy"]);
  });

  it("buckets 7.5 <= CGPA < 9 as moderate", () => {
    const result = filterCourseEntries(all, withDifficulty("moderate"));
    expect(result.map((e) => e.normCode)).toEqual(["moderate"]);
  });

  it("buckets CGPA < 7.5 as tough", () => {
    const result = filterCourseEntries(all, withDifficulty("tough"));
    expect(result.map((e) => e.normCode)).toEqual(["tough"]);
  });

  it("excludes courses without grade data", () => {
    const result = filterCourseEntries(all, withDifficulty("easy"));
    expect(result.map((e) => e.normCode)).not.toContain("none");
  });
});

describe("compareProfessorEntries", () => {
  it("orders by professor rating with null handling", () => {
    const high = makeProfessorEntry({ groupId: "p-high", maxRating: 4.7 });
    const low = makeProfessorEntry({ groupId: "p-low", maxRating: 3.2 });
    const none = makeProfessorEntry({ groupId: "p-none", maxRating: null });

    const desc = [low, none, high].sort((a, b) =>
      compareProfessorEntries(a, b, "profRating", "desc"),
    );
    expect(desc.map((e) => e.groupId)).toEqual(["p-high", "p-low", "p-none"]);

    const asc = [low, none, high].sort((a, b) =>
      compareProfessorEntries(a, b, "profRating", "asc"),
    );
    expect(asc.map((e) => e.groupId)).toEqual(["p-none", "p-low", "p-high"]);
  });
});

describe("getCourseDiscipline", () => {
  it("extracts the uppercase subject prefix", () => {
    expect(getCourseDiscipline("BIO 1130")).toBe("BIO");
    expect(getCourseDiscipline("csi2110")).toBe("CSI");
    expect(getCourseDiscipline("ADM1100")).toBe("ADM");
  });

  it("returns null when no prefix is present", () => {
    expect(getCourseDiscipline("1130")).toBeNull();
  });
});

describe("filterCourseEntries disciplines", () => {
  const bio = makeCourseEntry({ normCode: "bio1130", courseCode: "BIO 1130" });
  const csi = makeCourseEntry({ normCode: "csi2110", courseCode: "CSI 2110" });
  const mat = makeCourseEntry({ normCode: "mat1320", courseCode: "MAT 1320" });
  const all = [bio, csi, mat];

  it("keeps only courses in the selected disciplines", () => {
    const result = filterCourseEntries(all, { ...EMPTY_FILTERS, disciplines: ["BIO", "MAT"] });
    expect(result.map((e) => e.courseCode)).toEqual(["BIO 1130", "MAT 1320"]);
  });

  it("returns all courses when no discipline is selected", () => {
    const result = filterCourseEntries(all, EMPTY_FILTERS);
    expect(result).toHaveLength(3);
  });
});

describe("filterProfessorEntries", () => {
  const bioProf = makeProfessorEntry({ groupId: "bio", disciplines: ["BIO"], maxRating: 4.5 });
  const csiProf = makeProfessorEntry({ groupId: "csi", disciplines: ["CSI"], maxRating: 3.1 });
  const multiProf = makeProfessorEntry({
    groupId: "multi",
    disciplines: ["BIO", "CSI"],
    maxRating: null,
  });
  const all = [bioProf, csiProf, multiProf];

  it("filters by discipline (any overlap)", () => {
    const result = filterProfessorEntries(all, { ...EMPTY_FILTERS, disciplines: ["BIO"] });
    expect(result.map((e) => e.groupId)).toEqual(["bio", "multi"]);
  });

  it("combines discipline and rating filters", () => {
    const result = filterProfessorEntries(all, {
      ...EMPTY_FILTERS,
      disciplines: ["BIO"],
      minRating: 4,
    });
    expect(result.map((e) => e.groupId)).toEqual(["bio"]);
  });

  it("returns all entries when no relevant filter is active", () => {
    expect(filterProfessorEntries(all, EMPTY_FILTERS)).toHaveLength(3);
  });
});
