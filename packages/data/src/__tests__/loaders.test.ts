import { describe, expect, it } from "vitest";
import {
  DataProto,
  FeedbackProto,
  normalizeCourseCode,
  toProtoCatalogue,
  toProtoSchedulesData,
} from "@uoplan/core";
import type { Catalogue } from "@uoplan/core";
import {
  dataAssetIds,
  loadCatalogue,
  loadCatalogueManifest,
  loadDisciplines,
  loadFeedback,
  loadGrades,
  loadIndices,
  loadProfessorRatings,
  loadProfessors,
  loadRateMyProfessors,
  loadSchedules,
  loadTerms,
} from "../loaders";
import { encode, fetchFrom, schedulesFor } from "./testFixtures";

const catalogue: Catalogue = {
  courses: [
    {
      code: normalizeCourseCode("CSI 2110"),
      title: "Data Structures",
      credits: 3,
      description: "",
      component: "Lecture",
      aliases: [normalizeCourseCode("ITI 2110")],
    },
  ],
  programs: [
    {
      title: "Honours Computer Science",
      url: "https://catalogue.uottawa.ca/en/undergrad/honours-bsc-computer-science/",
      slug: "undergrad/honours-bsc-computer-science/",
      requirements: [{ type: "course", code: "CSI 2110" }],
    },
  ],
};

const schedules = {
  ...schedulesFor("2261"),
  totalCourses: 1,
  totalWithSchedules: 1,
};

const distribution = {
  aPlus: 4,
  a: 3,
  aMinus: 0,
  bPlus: 0,
  b: 2,
  cPlus: 0,
  c: 0,
  dPlus: 0,
  d: 0,
  e: 0,
  f: 1,
  ein: 0,
  ns: 0,
  nc: 0,
  abs: 0,
  p: 0,
  s: 0,
};

describe("catalogue and schedule loaders", () => {
  it("loads canonical asset ids and decodes protobuf bytes into domain data", async () => {
    const fetchBytes = fetchFrom({
      [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years: [2026, 2025] })),
      [dataAssetIds.catalogue(2026)]: encode(
        DataProto.Catalogue.encode(toProtoCatalogue(catalogue)),
      ),
      [dataAssetIds.schedules("2261")]: encode(
        DataProto.SchedulesData.encode(toProtoSchedulesData(schedules)),
      ),
    });

    await expect(loadCatalogueManifest(fetchBytes)).resolves.toEqual({ years: [2026, 2025] });
    await expect(loadCatalogue(fetchBytes, 2026)).resolves.toMatchObject({
      courses: [
        { code: normalizeCourseCode("CSI 2110"), aliases: [normalizeCourseCode("ITI 2110")] },
      ],
      programs: [{ title: "Honours Computer Science" }],
    });
    await expect(loadSchedules(fetchBytes, "2261")).resolves.toMatchObject({
      termId: "2261",
      schedules: [{ courseCode: normalizeCourseCode("CSI 2110"), components: { LEC: [{}] } }],
    });

    expect(fetchBytes).toHaveBeenCalledWith("catalogue.pb");
    expect(fetchBytes).toHaveBeenCalledWith("catalogue.2026.pb");
    expect(fetchBytes).toHaveBeenCalledWith("schedules.2261.pb");
  });
});

describe("supporting dataset loaders", () => {
  it("decodes terms, indices, disciplines, professors, ratings, grades, and feedback data", async () => {
    const fetchBytes = fetchFrom({
      [dataAssetIds.terms]: encode(
        DataProto.TermsData.encode({ terms: [{ termId: 2261, name: "Winter 2026" }] }),
      ),
      [dataAssetIds.indices]: encode(
        DataProto.Indices.encode({
          courses: ["CSI 2110"],
          programs: ["Honours Computer Science"],
          disciplines: ["CSI"],
        }),
      ),
      [dataAssetIds.disciplines]: encode(
        DataProto.DisciplinesData.encode({
          disciplines: [{ code: "CSI", name: "Computer Science", nameFr: "Informatique" }],
        }),
      ),
      [dataAssetIds.professors]: encode(
        DataProto.ProfessorsData.encode({
          professors: [
            {
              slug: "alice-smith",
              name: "Alice Smith",
              legacyIds: [123],
              rating: 4.7,
              numRatings: 12,
              aliases: ["A. Smith"],
            },
          ],
        }),
      ),
      [dataAssetIds.rateMyProfessors]: encode(
        DataProto.RateMyProfessorsData.encode({
          resultCount: 1,
          professors: [
            { id: "rmp-123", legacyId: 123, name: "Alice Smith", rating: 4.7, numRatings: 12 },
          ],
        }),
      ),
      [dataAssetIds.grades]: encode(
        DataProto.GradesData.encode({
          courses: [
            {
              code: "CSI 2110",
              professors: [{ name: "Alice Smith", legacyId: 123, termId: 2261, distribution }],
            },
          ],
        }),
      ),
      [dataAssetIds.feedback]: encode(
        FeedbackProto.FeedbackData.encode({
          questions: [{ text: "The professor was effective", scale: true, optionSet: 1 }],
          professors: ["Alice Smith"],
          professorRefs: [1],
          extraCourses: [],
          indicesCourseCount: 1,
          terms: [
            {
              termId: 2261,
              courses: [
                {
                  course: 0,
                  sections: [
                    {
                      section: "A00",
                      professor: 0,
                      questionSet: 0,
                      responses: [10],
                      registered: [50],
                      averages: [45],
                    },
                  ],
                },
              ],
            },
          ],
          questionSets: [{ questions: [0] }],
          optionSets: [{ options: ["Excellent", "Poor"] }],
        }),
      ),
    });

    await expect(loadTerms(fetchBytes)).resolves.toEqual({
      terms: [{ termId: "2261", name: "Winter 2026" }],
    });
    await expect(loadIndices(fetchBytes)).resolves.toEqual({
      courses: ["CSI 2110"],
      programs: ["Honours Computer Science"],
      disciplines: ["CSI"],
    });
    await expect(loadDisciplines(fetchBytes)).resolves.toEqual({
      disciplines: [{ code: "CSI", name: "Computer Science", nameFr: "Informatique" }],
    });
    await expect(loadProfessors(fetchBytes)).resolves.toEqual([
      {
        slug: "alice-smith",
        name: "Alice Smith",
        legacyIds: [123],
        rating: 4.7,
        numRatings: 12,
        aliases: ["A. Smith"],
      },
    ]);
    await expect(loadRateMyProfessors(fetchBytes)).resolves.toEqual({
      resultCount: 1,
      professors: [
        { id: "rmp-123", legacyId: 123, name: "Alice Smith", rating: 4.7, numRatings: 12 },
      ],
    });
    await expect(loadProfessorRatings(fetchBytes)).resolves.toEqual({
      "Alice Smith": { id: "rmp-123", legacyId: 123, rating: 4.7, numRatings: 12 },
    });
    await expect(loadGrades(fetchBytes)).resolves.toMatchObject({
      courses: [
        {
          code: normalizeCourseCode("CSI 2110"),
          professors: [{ name: "Alice Smith", termId: 2261, distribution: { "A+": 4, A: 3 } }],
        },
      ],
    });
    await expect(loadFeedback(fetchBytes)).resolves.toMatchObject({
      questions: [{ text: "The professor was effective", scale: true }],
      professors: ["Alice Smith"],
      professorRefs: [1],
      terms: [{ termId: 2261 }],
    });
  });
});
