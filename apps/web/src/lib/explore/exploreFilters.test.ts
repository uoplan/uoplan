import { describe, expect, it } from "vitest";
import type { GradeVizData, RemainingRequirement } from "@uoplan/core";
import { buildTermPresenceIndex } from "./gradesSearch";
import type {
  ExploreCourseSearchEntry,
  ExploreOfferingFlat,
  ExploreProfessorSearchEntry,
} from "./gradesSearch";
import {
  buildRequirementCandidateSet,
  compareCourseEntries,
  compareProfessorEntries,
  EMPTY_FILTERS,
  filterCourseEntries,
  filterProfessorEntries,
  getCourseDiscipline,
  hasActiveFilters,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
} from "./exploreFilters";
import type { ExploreFilterState } from "./exploreFilters";
import { testCourseCode, testProfessorName } from "../../test/brands";

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

type CourseEntryPartial = Partial<
  Omit<ExploreCourseSearchEntry, "normCode" | "courseCode" | "componentId">
> & {
  normCode?: string;
  courseCode?: string;
  componentId?: string;
};

function makeCourseEntry(partial: CourseEntryPartial): ExploreCourseSearchEntry {
  return {
    normCode: testCourseCode(partial.normCode ?? "csi1100"),
    courseCode: testCourseCode(partial.courseCode ?? "CSI 1100"),
    courseTitle: partial.courseTitle ?? "Intro",
    fuseText: partial.fuseText ?? "csi 1100 intro",
    gradeViz: partial.gradeViz ?? null,
    level: partial.level ?? 1000,
    language: partial.language ?? "en",
    maxProfessorRating: partial.maxProfessorRating ?? null,
    componentId: testCourseCode(partial.componentId ?? partial.normCode ?? "csi1100"),
  };
}

function makeProfessorEntry(
  partial: Partial<Omit<ExploreProfessorSearchEntry, "displayName">> & { displayName?: string },
): ExploreProfessorSearchEntry {
  return {
    groupId: partial.groupId ?? "prof-1",
    legacyId: partial.legacyId,
    displayName: testProfessorName(partial.displayName ?? "Prof One"),
    searchText: partial.searchText ?? "prof one",
    uniqueCourseCount: partial.uniqueCourseCount ?? 2,
    disciplines: partial.disciplines ?? [],
    gradeViz: partial.gradeViz ?? null,
    maxRating: partial.maxRating ?? null,
  };
}

type OfferingPartial = Partial<Omit<ExploreOfferingFlat, "courseCode" | "professorName">> & {
  courseCode?: string;
  professorName?: string;
};

function makeOffering(partial: OfferingPartial): ExploreOfferingFlat {
  return {
    id: partial.id ?? "offering",
    courseCode: testCourseCode(partial.courseCode ?? "CSI 1100"),
    courseTitle: partial.courseTitle ?? "Intro",
    professorName: testProfessorName(partial.professorName ?? "Ada Lovelace"),
    legacyId: partial.legacyId,
    termId: partial.termId ?? 2269,
    termLabel: partial.termLabel ?? "Fall 2026",
    section: partial.section,
    fuseText: partial.fuseText ?? "",
    distribution: partial.distribution ?? {},
  };
}

describe("parseExploreFiltersSearch", () => {
  it("parses filters and sort from search params", () => {
    const parsed = parseExploreFiltersSearch({
      levels: "1000,2000,9000",
      langs: "en,fr,es",
      disc: "bio, CSI ,bio",
      difficulty: "moderate",
      rating: "3.5",
      sort: "code",
      dir: "asc",
    });

    expect(parsed.levels).toEqual([1000, 2000]);
    expect(parsed.languages).toEqual(["en", "fr"]);
    expect(parsed.disciplines).toEqual(["BIO", "CSI"]);
    expect(parsed.difficulty).toBe("moderate");
    expect(parsed.minRating).toBe(3.5);
    expect(parsed.sortKey).toBe("code");
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
    const parsed = parseExploreFiltersSearch({ sort: "grade" });
    expect(parsed.sortKey).toBe("grade");
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
      minFeedback: null,
      termId: null,
      contributesToRequirements: false,
      sortKey: "grade",
      sortDir: "desc",
    };

    expect(serializeExploreFiltersSearch(filters)).toEqual({
      levels: "1000,2000",
      langs: "en",
      disc: "BIO,CSI",
      difficulty: "easy",
      rating: 4,
      sort: "grade",
      dir: "desc",
    });
  });

  it("round-trips the term filter through search params", () => {
    const params = serializeExploreFiltersSearch({ ...EMPTY_FILTERS, termId: 2269 });
    expect(params).toEqual({ term: 2269 });
    expect(parseExploreFiltersSearch(params).termId).toBe(2269);
  });

  it("round-trips the feedback filter through search params", () => {
    const params = serializeExploreFiltersSearch({ ...EMPTY_FILTERS, minFeedback: 3.5 });
    expect(params).toEqual({ feedback: 3.5 });
    expect(parseExploreFiltersSearch(params).minFeedback).toBe(3.5);
  });

  it("round-trips the contributes-to-requirements filter", () => {
    const params = serializeExploreFiltersSearch({
      ...EMPTY_FILTERS,
      contributesToRequirements: true,
    });
    expect(params).toEqual({ reqs: "1" });
    expect(parseExploreFiltersSearch(params).contributesToRequirements).toBe(true);
  });

  it("omits the requirements flag when off and defaults to false", () => {
    expect(serializeExploreFiltersSearch(EMPTY_FILTERS).reqs).toBeUndefined();
    expect(parseExploreFiltersSearch({}).contributesToRequirements).toBe(false);
    expect(parseExploreFiltersSearch({ reqs: "0" }).contributesToRequirements).toBe(false);
  });

  it("treats the requirements flag as an active filter", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, contributesToRequirements: true })).toBe(true);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("ignores invalid feedback values", () => {
    expect(parseExploreFiltersSearch({ feedback: "nope" }).minFeedback).toBeNull();
    expect(parseExploreFiltersSearch({ feedback: "2" }).minFeedback).toBeNull();
  });

  it("ignores invalid term values", () => {
    expect(parseExploreFiltersSearch({ term: "abc" }).termId).toBeNull();
    expect(parseExploreFiltersSearch({ term: "0" }).termId).toBeNull();
    expect(parseExploreFiltersSearch({ term: "12.5" }).termId).toBeNull();
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

    const desc = [low, none, high].sort((a, b) => compareCourseEntries(a, b, "grade", "desc"));
    expect(desc.map((e) => e.normCode)).toEqual(["csi2100", "csi1100", "csi3100"]);

    const asc = [low, none, high].sort((a, b) => compareCourseEntries(a, b, "grade", "asc"));
    expect(asc.map((e) => e.normCode)).toEqual(["csi3100", "csi1100", "csi2100"]);
  });

  it("orders by course code", () => {
    const a = makeCourseEntry({ normCode: "csi1100", courseCode: "CSI 1100" });
    const b = makeCourseEntry({ normCode: "csi2100", courseCode: "CSI 2100" });

    const asc = [b, a].sort((x, y) => compareCourseEntries(x, y, "code", "asc"));
    expect(asc.map((e) => e.courseCode)).toEqual(["CSI 1100", "CSI 2100"]);

    const desc = [a, b].sort((x, y) => compareCourseEntries(x, y, "code", "desc"));
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

describe("filterCourseEntries contributes-to-requirements", () => {
  const inPlan = makeCourseEntry({ normCode: "csi2110", courseCode: "CSI 2110" });
  const alsoInPlan = makeCourseEntry({ normCode: "mat1320", courseCode: "MAT 1320" });
  const offPlan = makeCourseEntry({ normCode: "phi1101", courseCode: "PHI 1101" });
  const all = [inPlan, alsoInPlan, offPlan];
  const candidates = new Set(["csi2110", "mat1320"]);
  const filters: ExploreFilterState = { ...EMPTY_FILTERS, contributesToRequirements: true };

  it("keeps only courses in the requirement candidate set", () => {
    const result = filterCourseEntries(all, filters, undefined, undefined, candidates);
    expect(result.map((e) => e.normCode)).toEqual(["csi2110", "mat1320"]);
  });

  it("is a no-op when no candidate set is supplied", () => {
    expect(filterCourseEntries(all, filters)).toEqual(all);
    expect(filterCourseEntries(all, filters, undefined, undefined, null)).toEqual(all);
  });

  it("ignores the candidate set when the flag is off", () => {
    expect(filterCourseEntries(all, EMPTY_FILTERS, undefined, undefined, candidates)).toEqual(all);
  });
});

describe("buildRequirementCandidateSet", () => {
  const req = (requirementId: string, candidateCourses: string[]): RemainingRequirement => ({
    requirementId,
    type: "course",
    candidateCourses,
    satisfiedBy: [],
  });

  it("collects normalized candidate codes across requirements", () => {
    const set = buildRequirementCandidateSet([
      req("req-1", ["CSI 2110", "MAT 1320"]),
      req("req-2", ["csi2120"]),
    ]);
    expect([...set].sort()).toEqual(["CSI 2110", "CSI 2120", "MAT 1320"]);
  });

  it("excludes courses the student has already taken (any code formatting)", () => {
    const set = buildRequirementCandidateSet(
      [req("req-1", ["CSI 2110", "MAT 1320", "CSI 2120"])],
      ["csi2110", "MAT1320"],
    );
    expect([...set]).toEqual(["CSI 2120"]);
  });

  it("returns an empty set when every candidate is already completed", () => {
    const set = buildRequirementCandidateSet([req("req-1", ["CSI 2110"])], ["CSI 2110"]);
    expect(set.size).toBe(0);
  });
});

describe("compareProfessorEntries", () => {
  it("orders by professor rating with null handling", () => {
    const high = makeProfessorEntry({ groupId: "p-high", maxRating: 4.7 });
    const low = makeProfessorEntry({ groupId: "p-low", maxRating: 3.2 });
    const none = makeProfessorEntry({ groupId: "p-none", maxRating: null });

    const desc = [low, none, high].sort((a, b) => compareProfessorEntries(a, b, "rating", "desc"));
    expect(desc.map((e) => e.groupId)).toEqual(["p-high", "p-low", "p-none"]);

    const asc = [low, none, high].sort((a, b) => compareProfessorEntries(a, b, "rating", "asc"));
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

describe("feedback (overall sentiment) filter", () => {
  const a = makeCourseEntry({ normCode: "csi1100", componentId: "csi1100" });
  const b = makeCourseEntry({ normCode: "csi2100", componentId: "csi2100" });
  const c = makeCourseEntry({ normCode: "csi3100", componentId: "csi3100" });
  const courses = [a, b, c];
  const courseSentiment = new Map([
    ["csi1100", 4.2],
    ["csi2100", 3.1],
    // csi3100 has no feedback
  ]);

  it("keeps only courses at/above the threshold (excluding those without feedback)", () => {
    const result = filterCourseEntries(courses, { ...EMPTY_FILTERS, minFeedback: 3.5 }, undefined, {
      courseByNorm: courseSentiment,
      professorByGroupId: null,
    });
    expect(result.map((e) => e.normCode)).toEqual(["csi1100"]);
  });

  it("skips the feedback filter while the sentiment map is still loading (null)", () => {
    const result = filterCourseEntries(courses, { ...EMPTY_FILTERS, minFeedback: 3.5 }, undefined, {
      courseByNorm: null,
      professorByGroupId: null,
    });
    expect(result).toHaveLength(3);
  });

  it("filters professors by their sentiment", () => {
    const p1 = makeProfessorEntry({ groupId: "p1" });
    const p2 = makeProfessorEntry({ groupId: "p2" });
    const p3 = makeProfessorEntry({ groupId: "p3" });
    const profSentiment = new Map([
      ["p1", 4.0],
      ["p2", 3.0],
    ]);
    const result = filterProfessorEntries(
      [p1, p2, p3],
      { ...EMPTY_FILTERS, minFeedback: 3.5 },
      undefined,
      { courseByNorm: null, professorByGroupId: profSentiment },
    );
    expect(result.map((e) => e.groupId)).toEqual(["p1"]);
  });
});

describe("term presence filter", () => {
  it("restricts courses to those present in the selected term", () => {
    const a = makeCourseEntry({ normCode: "csi1100", componentId: "csi1100" });
    const b = makeCourseEntry({ normCode: "csi2100", componentId: "csi2100" });
    const filters: ExploreFilterState = { ...EMPTY_FILTERS, termId: 2269 };
    const termSets = { courseComponents: new Set(["csi1100"]), profGroups: null };

    const result = filterCourseEntries([a, b], filters, termSets);
    expect(result.map((e) => e.normCode)).toEqual(["csi1100"]);
  });

  it("excludes all courses when the term has no presence set", () => {
    const a = makeCourseEntry({ normCode: "csi1100", componentId: "csi1100" });
    const filters: ExploreFilterState = { ...EMPTY_FILTERS, termId: 2269 };

    expect(filterCourseEntries([a], filters)).toHaveLength(0);
    expect(
      filterCourseEntries([a], filters, { courseComponents: null, profGroups: null }),
    ).toHaveLength(0);
  });

  it("restricts professors to those present in the selected term", () => {
    const inTerm = makeProfessorEntry({ groupId: "id:1" });
    const outOfTerm = makeProfessorEntry({ groupId: "id:2" });
    const filters: ExploreFilterState = { ...EMPTY_FILTERS, termId: 2269 };
    const termSets = { courseComponents: null, profGroups: new Set(["id:1"]) };

    const result = filterProfessorEntries([inTerm, outOfTerm], filters, termSets);
    expect(result.map((e) => e.groupId)).toEqual(["id:1"]);
  });
});

describe("buildTermPresenceIndex", () => {
  it("maps offerings to course-component and professor-group sets per term", () => {
    const offerings = [
      makeOffering({
        courseCode: "CSI 1100",
        professorName: testProfessorName("Ada Lovelace"),
        legacyId: 1,
        termId: 2269,
      }),
      makeOffering({
        courseCode: "MAT 1320",
        professorName: testProfessorName("Carl Gauss"),
        termId: 2269,
      }),
      makeOffering({
        courseCode: "CSI 1100",
        professorName: testProfessorName("Staff"),
        legacyId: 9,
        termId: 2271,
      }),
    ];

    const index = buildTermPresenceIndex(
      offerings,
      new Map([[testCourseCode("CSI 1100"), testCourseCode("comp-csi")]]),
    );

    expect(index.courseComponentsByTerm.get(2269)).toEqual(new Set(["comp-csi", "MAT 1320"]));
    expect(index.courseComponentsByTerm.get(2271)).toEqual(new Set(["comp-csi"]));
    expect(index.profGroupsByTerm.get(2269)).toEqual(new Set(["id:1", "name:carl gauss"]));
    // "Staff" placeholder instructors are never indexed as professors.
    expect(index.profGroupsByTerm.get(2271)).toBeUndefined();
  });
});
