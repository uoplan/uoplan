import { describe, expect, it } from "vitest";
import {
  buildGradeLookups,
  distributionForSection,
  enrichSchedulesDataWithGrades,
  getGradeLookups,
  lookupSectionDistribution,
  normalizeInstructorName,
  sumGradeDistributions,
} from "../gradeLookup";
import type { CourseGradesData, SchedulesData } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

describe("normalizeInstructorName", () => {
  it("strips accents, lowercases, and collapses whitespace", () => {
    expect(normalizeInstructorName("  Renée   O'BRÏEN ")).toBe("renee o'brien");
  });
});

describe("sumGradeDistributions", () => {
  it("adds matching buckets and ignores non-finite values", () => {
    expect(
      sumGradeDistributions([{ "A+": 2, A: 1 }, { "A+": 3, B: 5 }, { A: Number.NaN }]),
    ).toEqual({ "A+": 5, A: 1, B: 5 });
  });
});

const grades: CourseGradesData = {
  courses: [
    {
      code: normalizeCourseCode("CSI 2110"),
      sections: [
        { name: "Alice Smith", termId: 2231, distribution: { "A+": 10, B: 2 } },
        { name: "Álice Smith", termId: 2231, distribution: { "A+": 5 } },
        { name: "Bob Jones", termId: 2231, distribution: { C: 4 } },
        { name: "Carl Other", termId: 2229, distribution: { "A+": 1 } },
      ],
    },
    {
      code: normalizeCourseCode("MAT 1320"),
      sections: [{ name: "Zoe Zero", termId: 2231, distribution: { F: 0 } }],
    },
  ],
};

describe("buildGradeLookups + lookupSectionDistribution", () => {
  const lookups = buildGradeLookups(grades);

  it("merges distributions across name-normalized duplicates for matched instructors", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("CSI 2110"), 2231, [
      "Alice Smith",
    ]);
    expect(res.kind).toBe("matched");
    expect(res.distribution).toEqual({ "A+": 15, B: 2 });
  });

  it("sums multiple matched instructors", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("CSI 2110"), 2231, [
      "Alice Smith",
      "Bob Jones",
    ]);
    expect(res.kind).toBe("matched");
    expect(res.distribution).toEqual({ "A+": 15, B: 2, C: 4 });
  });

  it("falls back to the course aggregate when no instructor matches for the term", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("CSI 2110"), 2231, [
      "Nobody Here",
    ]);
    expect(res.kind).toBe("fallback");
    // aggregate spans ALL professor rows regardless of term
    expect(res.distribution).toEqual({ "A+": 16, B: 2, C: 4 });
  });

  it("skips the literal 'staff' instructor", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("CSI 2110"), 2231, [
      "Staff",
    ]);
    expect(res.kind).toBe("fallback");
  });

  it("returns none when the course has no positive grade data", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("MAT 1320"), 2231, [
      "Zoe Zero",
    ]);
    expect(res.kind).toBe("none");
    expect(res.distribution).toBeUndefined();
  });

  it("returns none for an unknown course", () => {
    expect(
      lookupSectionDistribution(lookups, normalizeCourseCode("PHY 9999"), 2231, ["Anyone"]).kind,
    ).toBe("none");
  });

  it("does not match instructors from a different term but still allows aggregate fallback", () => {
    const res = lookupSectionDistribution(lookups, normalizeCourseCode("CSI 2110"), 2229, [
      "Alice Smith",
    ]);
    // Alice has no 2229 row, so matched fails; aggregate fallback applies.
    expect(res.kind).toBe("fallback");
  });
});

describe("distributionForSection", () => {
  it("ignores fallback once any instructor matches", () => {
    const profMap = new Map([[normalizeInstructorName("Alice Smith"), { "A+": 3 }]]);
    const aggregate = { "A+": 99 };
    const res = distributionForSection(["Alice Smith", "Unknown"], profMap, aggregate);
    expect(res).toEqual({ distribution: { "A+": 3 }, kind: "matched" });
  });
});

describe("getGradeLookups", () => {
  it("returns the same memoized lookups for the same grades object", () => {
    expect(getGradeLookups(grades)).toBe(getGradeLookups(grades));
  });
});

describe("enrichSchedulesDataWithGrades", () => {
  const baseSchedules: SchedulesData = {
    termId: "2231",
    schedules: [
      {
        subject: "CSI",
        catalogNumber: "2110",
        courseCode: normalizeCourseCode("CSI 2110"),
        title: "Data Structures",
        timeZone: "America/Toronto",
        components: {
          LEC: [
            {
              section: "A00",
              sectionCode: null,
              component: "LEC",
              session: null,
              status: null,
              times: [
                {
                  day: "Mo",
                  startMinutes: 600,
                  endMinutes: 680,
                  virtual: false,
                  instructor: "Alice Smith",
                  meetingDates: null,
                },
              ],
            },
            {
              section: "B00",
              sectionCode: null,
              component: "LEC",
              session: null,
              status: null,
              times: [
                {
                  day: "Tu",
                  startMinutes: 600,
                  endMinutes: 680,
                  virtual: false,
                  instructor: "Nobody Here",
                  meetingDates: null,
                },
              ],
            },
          ],
        },
      },
    ],
  };

  it("populates matched and fallback distributions like the build-time enricher", () => {
    const enriched = enrichSchedulesDataWithGrades(
      baseSchedules,
      buildGradeLookups(grades),
      Number(baseSchedules.termId),
    );
    const [matched, fallback] = enriched.schedules[0].components.LEC;
    expect(matched.distribution).toEqual({ "A+": 15, B: 2 });
    expect(fallback.distribution).toEqual({ "A+": 16, B: 2, C: 4 });
  });

  it("does not mutate the input or share section objects", () => {
    const enriched = enrichSchedulesDataWithGrades(
      baseSchedules,
      buildGradeLookups(grades),
      Number(baseSchedules.termId),
    );
    expect(baseSchedules.schedules[0].components.LEC[0].distribution).toBeUndefined();
    expect(enriched).not.toBe(baseSchedules);
    expect(enriched.schedules[0]).not.toBe(baseSchedules.schedules[0]);
    expect(enriched.schedules[0].components.LEC[0]).not.toBe(
      baseSchedules.schedules[0].components.LEC[0],
    );
  });

  it("clears any stale distribution when the lookup finds none", () => {
    const withStale: SchedulesData = {
      ...baseSchedules,
      schedules: [
        {
          ...baseSchedules.schedules[0],
          courseCode: normalizeCourseCode("PHY 9999"),
          components: {
            LEC: [
              {
                ...baseSchedules.schedules[0].components.LEC[0],
                distribution: { "A+": 999 },
              },
            ],
          },
        },
      ],
    };
    const enriched = enrichSchedulesDataWithGrades(
      withStale,
      buildGradeLookups(grades),
      Number(withStale.termId),
    );
    expect(enriched.schedules[0].components.LEC[0].distribution).toBeUndefined();
  });
});
