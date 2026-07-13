import { describe, expect, it } from "vitest";
import {
  DataProto,
  FeedbackProto,
  fromProtoImportantDatesData,
  normalizeCourseCode,
  toProtoCatalogue,
  toProtoImportantDatesData,
  toProtoIndices,
  toProtoSchedulesData,
} from "@uoplan/core";
import type { Catalogue, ImportantDatesData } from "@uoplan/core";
import {
  courseDescriptionMapDecoder,
  dataAssetIds,
  loadCatalogueManifest,
  loadCatalogueUnion,
  loadDisciplines,
  loadFeedback,
  loadGrades,
  loadImportantDates,
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

// GRADE_KEYS order: A+ A A- B+ B C+ C D+ D E F DR EIN NS NC ABS P S
const distributionColumns = [4, 3, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];

const importantDatesEn: ImportantDatesData = {
  locale: "en",
  sourceUrl: "https://www.uottawa.ca/en/important-academic-dates-and-deadlines/",
  reviewedText: "Reviewed on 2026-01-02",
  terms: [
    {
      sourceId: "winter-2026",
      termId: "2261",
      label: "Winter term 2026",
      season: "winter",
      year: 2026,
      sourcePublished: "2025-12-10",
      termInterval: { startDate: "2026-01-05", endDate: "2026-04-30" },
      courseInterval: { startDate: "2026-01-12", endDate: "2026-04-10" },
      sessions: [],
      sections: [
        {
          id: "enrolment",
          label: "Enrolment",
          category: "enrolment",
          groups: [
            {
              id: "course-selection",
              items: [
                {
                  id: "course-selection-opens",
                  topic: "Course selection opens",
                  dateText: "January 5 to January 19, 2026",
                  effect: "deadline",
                  interval: { startDate: "2026-01-05", endDate: "2026-01-19" },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const importantDatesFr: ImportantDatesData = {
  locale: "fr-CA",
  sourceUrl: "https://www.uottawa.ca/fr/dates-et-echeances-importantes/",
  reviewedText: "Révisé le 2026-01-02",
  terms: [
    {
      sourceId: "hiver-2026",
      termId: "2261",
      label: "Trimestre d’hiver 2026",
      season: "winter",
      year: 2026,
      sourcePublished: "2025-12-10",
      termInterval: { startDate: "2026-01-05", endDate: "2026-04-30" },
      courseInterval: { startDate: "2026-01-12", endDate: "2026-04-10" },
      sessions: [],
      sections: [
        {
          id: "inscription",
          label: "Inscription",
          category: "enrolment",
          groups: [
            {
              id: "choix-de-cours",
              items: [
                {
                  id: "debut-choix-de-cours",
                  topic: "Début du choix de cours",
                  dateText: "Du 5 janvier au 19 janvier 2026",
                  effect: "deadline",
                  interval: { startDate: "2026-01-05", endDate: "2026-01-19" },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("catalogue and schedule loaders", () => {
  it("loads canonical asset ids and decodes protobuf bytes into domain data", async () => {
    const fetchBytes = fetchFrom({
      [dataAssetIds.manifest]: encode(DataProto.CatalogueManifest.encode({ years: [2026, 2025] })),
      [dataAssetIds.catalogueUnion]: encode(
        DataProto.Catalogue.encode(toProtoCatalogue(catalogue)),
      ),
      [dataAssetIds.schedules("2261")]: encode(
        DataProto.SchedulesData.encode(toProtoSchedulesData(schedules)),
      ),
    });

    await expect(loadCatalogueManifest(fetchBytes)).resolves.toEqual({ years: [2026, 2025] });
    await expect(loadCatalogueUnion(fetchBytes)).resolves.toMatchObject({
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
    expect(fetchBytes).toHaveBeenCalledWith("catalogue.union.pb");
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
        DataProto.Indices.encode(
          toProtoIndices({
            courses: ["CSI 2110"],
            programs: ["Honours Computer Science"],
            disciplines: ["CSI"],
          }),
        ),
      ),
      [dataAssetIds.disciplines]: encode(
        DataProto.DisciplinesData.encode({
          disciplines: [{ code: "CSI", name: "Computer Science", nameFr: "Informatique" }],
          faculties: [],
        }),
      ),
      [dataAssetIds.professors]: encode(
        DataProto.ProfessorsData.encode({
          professors: [
            {
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
          professors: [{ legacyId: 123, name: "Alice Smith", rating: 4.7, numRatings: 12 }],
        }),
      ),
      [dataAssetIds.grades]: encode(
        DataProto.GradesData.encode({
          sectionNames: ["Alice Smith"],
          courses: [
            {
              code: "CSI 2110",
              nameRefs: [0],
              termIds: [2261],
              professorRefs: [0],
              legacyIds: [123],
              sections: [""],
              distributions: distributionColumns,
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
                      registered: 50,
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
      faculties: [],
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
      professors: [{ legacyId: 123, name: "Alice Smith", rating: 4.7, numRatings: 12 }],
    });
    await expect(loadProfessorRatings(fetchBytes)).resolves.toEqual({
      "Alice Smith": { legacyId: 123, rating: 4.7, numRatings: 12 },
    });
    await expect(loadGrades(fetchBytes)).resolves.toMatchObject({
      courses: [
        {
          code: normalizeCourseCode("CSI 2110"),
          sections: [{ name: "Alice Smith", termId: 2261, distribution: { "A+": 4, A: 3 } }],
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

  describe("important dates loader", () => {
    it("maps locale-specific important dates asset ids", () => {
      expect(dataAssetIds.importantDates("en")).toBe("important-dates.en.pb");
      expect(dataAssetIds.importantDates("fr-CA")).toBe("important-dates.fr.pb");
    });

    it("fetches the requested locale asset and decodes localized important dates data", async () => {
      const fetchBytes = fetchFrom({
        [dataAssetIds.importantDates("en")]: encode(
          DataProto.ImportantDatesData.encode(toProtoImportantDatesData(importantDatesEn)),
        ),
        [dataAssetIds.importantDates("fr-CA")]: encode(
          DataProto.ImportantDatesData.encode(toProtoImportantDatesData(importantDatesFr)),
        ),
      });

      await expect(loadImportantDates(fetchBytes, "en")).resolves.toEqual(importantDatesEn);
      await expect(loadImportantDates(fetchBytes, "fr-CA")).resolves.toEqual(importantDatesFr);

      expect(fetchBytes).toHaveBeenCalledWith("important-dates.en.pb");
      expect(fetchBytes).toHaveBeenCalledWith("important-dates.fr.pb");
    });

    it("propagates invalid decoded enums from the protobuf payload", async () => {
      const proto = toProtoImportantDatesData(importantDatesEn);
      const fetchBytes = fetchFrom({
        [dataAssetIds.importantDates("en")]: encode(
          DataProto.ImportantDatesData.encode({
            ...proto,
            locale: DataProto.ImportantDatesLocale.IMPORTANT_DATES_LOCALE_UNSPECIFIED,
          }),
        ),
        [dataAssetIds.importantDates("fr-CA")]: encode(
          DataProto.ImportantDatesData.encode({
            ...toProtoImportantDatesData(importantDatesFr),
            terms: [
              {
                ...toProtoImportantDatesData(importantDatesFr).terms[0]!,
                season: DataProto.ImportantDateSeason.IMPORTANT_DATE_SEASON_UNSPECIFIED,
              },
            ],
          }),
        ),
      });

      await expect(loadImportantDates(fetchBytes, "en")).rejects.toThrow(
        "Important dates locale must not be unspecified",
      );
      await expect(loadImportantDates(fetchBytes, "fr-CA")).rejects.toThrow(
        "Important dates season must not be unspecified",
      );
    });

    it("uses real protobuf bytes that round-trip back to the original domain shape", () => {
      const enBytes = DataProto.ImportantDatesData.encode(
        toProtoImportantDatesData(importantDatesEn),
      ).finish();
      const frBytes = DataProto.ImportantDatesData.encode(
        toProtoImportantDatesData(importantDatesFr),
      ).finish();

      expect(fromProtoImportantDatesData(DataProto.ImportantDatesData.decode(enBytes))).toEqual(
        importantDatesEn,
      );
      expect(fromProtoImportantDatesData(DataProto.ImportantDatesData.decode(frBytes))).toEqual(
        importantDatesFr,
      );
    });
  });
});

describe("courseDescriptionMapDecoder", () => {
  it("decodes a valid shard and supports normalized course code lookup", () => {
    const bytes = encode(
      DataProto.CourseDescriptionShard.encode({
        courseCodes: ["MAT 1320", "MAT 1720"],
        descriptions: ["Calculus I", "Calculus II"],
      }),
    );

    const map = courseDescriptionMapDecoder.decode(bytes);

    expect(map.get(normalizeCourseCode("MAT 1320"))).toBe("Calculus I");
    expect(map.get(normalizeCourseCode("MAT 1720"))).toBe("Calculus II");
    expect(map.size).toBe(2);
  });

  it("returns a ReadonlyMap with correct asset id pattern", () => {
    expect(dataAssetIds.courseDescriptionShard("science")).toBe(
      "catalogue.descriptions.science.pb",
    );
    expect(dataAssetIds.courseDescriptionShard("other")).toBe("catalogue.descriptions.other.pb");
  });

  it("throws exactly 'Course description shard column lengths differ' on unequal columns", () => {
    const bytes = encode(
      DataProto.CourseDescriptionShard.encode({
        courseCodes: ["MAT 1320", "MAT 1720"],
        descriptions: ["Calculus I"],
      }),
    );

    expect(() => courseDescriptionMapDecoder.decode(bytes)).toThrow(
      "Course description shard column lengths differ",
    );
  });
});
