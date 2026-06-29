import type { FeedbackIndex, FeedbackSectionView } from "@uoplan/core/feedback";
import type { SchedulesData } from "@uoplan/core/dataTypes";
import { buildAliasGroups } from "@uoplan/core/courseAlias";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { buildCourseCompareModels } from "@/data/compare-courses";
import { buildExploreIndex, type AppDataBundle } from "@/data/explore-index";

function section(
  termId: number,
  professorName: string,
  average: number | null,
): FeedbackSectionView {
  return {
    termId,
    section: "A",
    professorName,
    registered: 100,
    questions: [{ questionId: 0, average, responses: average == null ? 0 : 25, registered: 100 }],
  };
}

function makeFeedback(): FeedbackIndex {
  return {
    questions: [{ text: "Overall", scale: true, options: [] }],
    byCourseNorm: new Map([
      [normalizeCourseCode("ITI 1120"), [section(2265, "Ada Lovelace", 4.25)]],
      [normalizeCourseCode("MAT 2520"), [section(2265, "Grace Hopper", 3.5)]],
    ]),
  };
}

function makeSchedules(): Map<string, SchedulesData> {
  return new Map([
    [
      "2265",
      {
        termId: "2265",
        schedules: [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: normalizeCourseCode("ITI 1120"),
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {},
          },
          {
            subject: "MAT",
            catalogNumber: "2520",
            courseCode: normalizeCourseCode("MAT 2520"),
            title: "Algèbre linéaire",
            timeZone: "America/Toronto",
            components: {},
          },
        ],
      } as SchedulesData,
    ],
  ]);
}

function makeBundle(): AppDataBundle {
  return {
    terms: [],
    faculties: [
      { id: "engineering", name: "Faculty of Engineering" },
      { id: "science", name: "Faculty of Science" },
    ],
    disciplines: [
      { code: "ITI", name: "Information Technology", facultyId: "engineering" },
      { code: "MAT", name: "Mathematics", facultyId: "science" },
    ],
    catalogue: {
      courses: [
        {
          code: normalizeCourseCode("ITI 1120"),
          title: "Intro to Computing",
          credits: 3,
          description: "",
        },
        {
          code: normalizeCourseCode("MAT 2520"),
          title: "Algèbre linéaire",
          credits: 4,
          description: "",
          prereqText: "MAT 1320",
        },
      ],
      programs: [],
    },
    professors: [
      {
        slug: "ada-lovelace",
        name: "Ada Lovelace",
        legacyIds: [],
        aliases: [],
        rating: 4.8,
      },
      { slug: "grace-hopper", name: "Grace Hopper", legacyIds: [], aliases: [] },
    ],
    ratings: {},
    grades: {
      courses: [
        {
          code: normalizeCourseCode("ITI 1120"),
          sections: [
            {
              name: "Ada Lovelace",
              professorRef: 1,
              termId: 2265,
              section: "",
              distribution: { A: 60, B: 30, F: 10 },
            },
          ],
        },
        {
          code: normalizeCourseCode("MAT 2520"),
          sections: [
            {
              name: "Grace Hopper",
              professorRef: 2,
              termId: 2265,
              section: "",
              distribution: { "A+": 25, C: 25, F: 50 },
            },
          ],
        },
      ],
    },
  } as unknown as AppDataBundle;
}

describe("buildCourseCompareModels", () => {
  it("loads multiple course compare models through the same detail data used by course pages", () => {
    const bundle = makeBundle();
    const schedulesByTerm = makeSchedules();
    const index = buildExploreIndex(bundle, schedulesByTerm);

    const models = buildCourseCompareModels({
      bundle,
      index,
      schedulesByTerm,
      feedback: makeFeedback(),
      aliasGroups: buildAliasGroups(bundle.catalogue),
      ids: ["MAT 2520", "missing", "ITI 1120"],
    });

    expect(models.map((model) => model.code)).toEqual(["MAT 2520", "ITI 1120"]);
    expect(models[0]).toMatchObject({
      title: "Algèbre linéaire",
      credits: 4,
      facultyName: "Faculty of Science",
      level: 2000,
      language: "fr",
      prerequisites: "MAT 1320",
      terms: ["Summer 2026"],
      averageGpa: 3.5,
      passingPercent: 50,
      topProfessorRating: null,
      sentiment: 3.5,
    });
    expect(models[1]).toMatchObject({
      title: "Intro to Computing",
      credits: 3,
      facultyName: "Faculty of Engineering",
      level: 1000,
      language: "en",
      prerequisites: null,
      terms: ["Summer 2026"],
      averageGpa: 7.2,
      passingPercent: 90,
      topProfessorRating: 4.8,
      sentiment: 4.25,
    });
    expect(models[1]?.gradeViz).not.toBeNull();
  });
});
