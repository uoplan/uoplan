import { describe, expect, it } from "vitest";
import { buildProfessorRegistry, normalizeCourseCode, unsafeBrand } from "@uoplan/core";
import type { ProfessorSlug } from "@uoplan/core";
import {
  courseMatchesCourseLevelFilters,
  filterCourseProfessorGroups,
  filterProfessorCourseGroups,
  professorMatchesRatingFilter,
} from "./detailFilters";
import { EMPTY_FILTERS } from "./exploreFilters";
import type { ExploreFilterState } from "./exploreFilters";
import type {
  ExploreCourseSearchEntry,
  ExploreOfferingFlat,
  ExploreProfessorSearchEntry,
} from "./gradesSearch";
import { testCourseCode, testProfessorName } from "../../test/brands";
import { makeOffering } from "../../test/exploreFilterFixtures";

function makeProfessorEntry(
  partial: Partial<Omit<ExploreProfessorSearchEntry, "displayName">> & { displayName?: string },
): ExploreProfessorSearchEntry {
  return {
    groupId: partial.groupId ?? "id:101",
    legacyId: partial.legacyId,
    displayName: testProfessorName(partial.displayName ?? "Ada Lovelace"),
    searchText: partial.searchText ?? "",
    uniqueCourseCount: partial.uniqueCourseCount ?? 1,
    disciplines: partial.disciplines ?? [],
    gradeViz: partial.gradeViz ?? null,
    maxRating: partial.maxRating ?? null,
  };
}

function makeCourseEntry(
  partial: Partial<Omit<ExploreCourseSearchEntry, "normCode" | "courseCode" | "componentId">> & {
    normCode?: string;
    courseCode?: string;
    componentId?: string;
  },
): ExploreCourseSearchEntry {
  return {
    normCode: testCourseCode(partial.normCode ?? "CSI1100"),
    courseCode: testCourseCode(partial.courseCode ?? "CSI 1100"),
    courseTitle: partial.courseTitle ?? "Intro",
    fuseText: partial.fuseText ?? "",
    gradeViz: partial.gradeViz ?? null,
    level: partial.level ?? 1000,
    language: partial.language ?? "en",
    maxProfessorRating: partial.maxProfessorRating ?? null,
    componentId: testCourseCode(partial.componentId ?? partial.normCode ?? "CSI1100"),
  };
}

const filters = (overrides: Partial<ExploreFilterState>): ExploreFilterState => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe("filterCourseProfessorGroups", () => {
  // Two professors teaching one course; Ada also teaches it in an earlier term.
  const courseOfferings: ExploreOfferingFlat[] = [
    makeOffering({ id: "a-fall", professorName: "Ada Lovelace", legacyId: 101, termId: 2269 }),
    makeOffering({ id: "a-winter", professorName: "Ada Lovelace", legacyId: 101, termId: 2261 }),
    makeOffering({ id: "b-winter", professorName: "Alan Turing", legacyId: 102, termId: 2261 }),
  ];

  it("returns every professor group and no aggregate when no filters are active", () => {
    const { groups, aggregateByGroupId } = filterCourseProfessorGroups(
      courseOfferings,
      filters({}),
      { profEntryByGroupId: new Map() },
    );
    expect(groups.map((g) => g.groupId).sort()).toEqual(["id:101", "id:102"]);
    expect(aggregateByGroupId).toBeNull();
  });

  it("term filter drops professors absent that term but keeps all-terms aggregates", () => {
    const { groups, aggregateByGroupId } = filterCourseProfessorGroups(
      courseOfferings,
      filters({ termId: 2269 }),
      { profEntryByGroupId: new Map() },
    );
    // Only Ada teaches in Fall (2269); her visible rows are trimmed to that term.
    expect(groups.map((g) => g.groupId)).toEqual(["id:101"]);
    expect(groups[0]!.offerings).toHaveLength(1);
    // ...but the histogram aggregate still spans both of Ada's terms.
    expect(aggregateByGroupId).not.toBeNull();
    expect(aggregateByGroupId!.get("id:101")).toHaveLength(2);
    expect(aggregateByGroupId!.get("id:102")).toHaveLength(1);
  });

  it("min-rating drops whole professor groups below the threshold", () => {
    const profEntryByGroupId = new Map<string, ExploreProfessorSearchEntry>([
      ["id:101", makeProfessorEntry({ groupId: "id:101", maxRating: 4.5 })],
      ["id:102", makeProfessorEntry({ groupId: "id:102", maxRating: 2 })],
    ]);
    const { groups } = filterCourseProfessorGroups(courseOfferings, filters({ minRating: 3 }), {
      profEntryByGroupId,
    });
    expect(groups.map((g) => g.groupId)).toEqual(["id:101"]);
  });

  it("keeps an expected (predicted) professor under their canonical group id when filtering by term", () => {
    // Ada is registry index 0 (legacyId 123); she taught CSI 1100 in a past term and
    // is the *expected* (unconfirmed) instructor for an unassigned section next term.
    const registry = buildProfessorRegistry([
      {
        slug: unsafeBrand<ProfessorSlug>("ada-lovelace"),
        name: testProfessorName("Ada Lovelace"),
        legacyIds: [123],
        aliases: [],
      },
    ]);
    const offerings: ExploreOfferingFlat[] = [
      makeOffering({
        id: "confirmed-past",
        professorName: "Ada Lovelace",
        professorRef: 0,
        legacyId: 123,
        termId: 2249,
        distribution: { "A+": 5 },
      }),
      makeOffering({
        id: "expected-future",
        professorName: "",
        unassignedInstructor: true,
        predictedInstructors: [{ name: "Ada Lovelace", legacyId: 123 }],
        termId: 2269,
        distribution: {},
      }),
    ];

    const { groups, aggregateByGroupId } = filterCourseProfessorGroups(
      offerings,
      filters({ termId: 2269 }),
      { profEntryByGroupId: new Map(), registry },
    );

    // The expected-only professor is still shown for the term, under her canonical
    // registry group id (not a split legacyId/name group)...
    expect(groups.map((g) => g.groupId)).toEqual(["ref:0"]);
    expect(groups[0]!.hasPredicted).toBe(true);
    // ...and her all-terms aggregate (keyed by the same id) still covers the past
    // confirmed term, so the grade histogram isn't blanked out.
    expect(aggregateByGroupId!.get("ref:0")).toHaveLength(2);
  });
});

describe("filterProfessorCourseGroups", () => {
  // One professor teaching two courses, each in a different term.
  const professorOfferings: ExploreOfferingFlat[] = [
    makeOffering({ id: "csi-fall", courseCode: "CSI 1100", legacyId: 101, termId: 2269 }),
    makeOffering({ id: "mat-winter", courseCode: "MAT 2125", legacyId: 101, termId: 2261 }),
  ];

  it("returns every course group and no aggregate when no filters are active", () => {
    const { groups, aggregateByGroupId } = filterProfessorCourseGroups(
      professorOfferings,
      filters({}),
      { courseEntryByNorm: new Map() },
    );
    expect(groups).toHaveLength(2);
    expect(aggregateByGroupId).toBeNull();
  });

  it("term filter narrows to courses taught that term, aggregate spans all terms", () => {
    const { groups, aggregateByGroupId } = filterProfessorCourseGroups(
      professorOfferings,
      filters({ termId: 2269 }),
      { courseEntryByNorm: new Map() },
    );
    expect(groups.map((g) => g.courseCode)).toEqual([normalizeCourseCode("CSI 1100")]);
    expect(aggregateByGroupId).not.toBeNull();
    expect(aggregateByGroupId!.size).toBe(2);
  });

  it("course-level filters drop whole course groups", () => {
    const courseEntryByNorm = new Map<string, ExploreCourseSearchEntry>([
      [normalizeCourseCode("CSI 1100"), makeCourseEntry({ courseCode: "CSI 1100", level: 1000 })],
      [normalizeCourseCode("MAT 2125"), makeCourseEntry({ courseCode: "MAT 2125", level: 2000 })],
    ]);
    const { groups } = filterProfessorCourseGroups(
      professorOfferings,
      filters({ levels: [1000] }),
      {
        courseEntryByNorm,
      },
    );
    expect(groups.map((g) => g.courseCode)).toEqual([normalizeCourseCode("CSI 1100")]);
  });
});

describe("courseMatchesCourseLevelFilters", () => {
  it("returns true when the course entry is unknown", () => {
    expect(courseMatchesCourseLevelFilters(undefined, filters({ levels: [1000] }))).toBe(true);
  });

  it("gates the whole course on level filters", () => {
    const entry = makeCourseEntry({ level: 1000 });
    expect(courseMatchesCourseLevelFilters(entry, filters({ levels: [1000] }))).toBe(true);
    expect(courseMatchesCourseLevelFilters(entry, filters({ levels: [2000] }))).toBe(false);
  });

  it("ignores rating, feedback and term (those narrow the professor list)", () => {
    const entry = makeCourseEntry({ level: 1000, maxProfessorRating: 1 });
    expect(
      courseMatchesCourseLevelFilters(
        entry,
        filters({ minRating: 5, minFeedback: 5, termId: 2269 }),
      ),
    ).toBe(true);
  });
});

describe("professorMatchesRatingFilter", () => {
  it("passes when no min-rating is set", () => {
    expect(professorMatchesRatingFilter(null, null)).toBe(true);
    expect(professorMatchesRatingFilter(2, null)).toBe(true);
  });

  it("fails an unrated professor against a min-rating", () => {
    expect(professorMatchesRatingFilter(null, 3)).toBe(false);
  });

  it("compares the professor rating against the threshold", () => {
    expect(professorMatchesRatingFilter(3.5, 3)).toBe(true);
    expect(professorMatchesRatingFilter(2.5, 3)).toBe(false);
  });
});
