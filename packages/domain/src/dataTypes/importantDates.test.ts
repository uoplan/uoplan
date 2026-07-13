import { describe, expect, it } from "vitest";

import {
  DayOfWeek as ProtoDayOfWeek,
  ImportantDateCategory as ProtoImportantDateCategory,
  ImportantDateEffect as ProtoImportantDateEffect,
  ImportantDatesData as ProtoImportantDatesData,
  ImportantDateSeason as ProtoImportantDateSeason,
  ImportantDatesLocale as ProtoImportantDatesLocale,
} from "@uoplan/proto/data";

import type { ImportantDatesData } from "./importantDates";
import { fromProtoImportantDatesData, toProtoImportantDatesData } from "./importantDates";

const FULL_DATA: ImportantDatesData = {
  locale: "fr-CA",
  sourceUrl: "https://www.uottawa.ca/dates-importantes/2025-2026",
  reviewedText: "Révision du 12 juillet 2026",
  terms: [
    {
      sourceId: "winter-2026",
      termId: "2261",
      label: "Hiver 2026",
      season: "winter",
      year: 2026,
      sourcePublished: "2025-10-15",
      termInterval: {
        startDate: "2026-01-01",
        endDate: "2026-04-30",
      },
      courseInterval: {
        startDate: "2026-01-07",
        endDate: "2026-04-10",
      },
      sessions: [
        {
          code: "A",
          courseInterval: {
            startDate: "2026-01-07",
            endDate: "2026-02-27",
          },
        },
        {
          code: "B",
          courseInterval: {
            startDate: "2026-03-02",
            endDate: "2026-04-10",
          },
        },
      ],
      sections: [
        {
          id: "overview",
          label: "Aperçu",
          category: "overview",
          groups: [
            {
              id: "overview-core",
              items: [
                {
                  id: "term-structure",
                  topic: "Structure du trimestre",
                  dateText: "7 janvier au 10 avril 2026",
                  effect: "structural",
                },
              ],
            },
          ],
        },
        {
          id: "breaks",
          label: "Congés et fermetures",
          category: "breaks",
          groups: [
            {
              id: "holiday-closures",
              label: "Congés universitaires",
              sessionCode: "A",
              items: [
                {
                  id: "new-year-closure",
                  topic: "Fermeture du campus pour le Nouvel An",
                  dateText: "31 décembre 2025, 16 h au 2 janvier 2026, 8 h",
                  effect: "no_classes",
                  interval: {
                    startDate: "2025-12-31",
                    endDate: "2026-01-02",
                    startMinutes: 16 * 60,
                    endMinutes: 8 * 60,
                  },
                },
                {
                  id: "family-day-replacement",
                  topic: "Horaire du lundi reporté au mercredi",
                  dateText: "Le 18 février 2026 remplace le 16 février 2026",
                  effect: "schedule_replacement",
                  replacement: {
                    cancelledDate: "2026-02-16",
                    replacementDate: "2026-02-18",
                    sourceDay: "Mo",
                  },
                  usedEnglishFallback: true,
                },
              ],
            },
          ],
        },
        {
          id: "student-services",
          label: "Services étudiants",
          category: "student_services",
          groups: [
            {
              id: "service-notices",
              items: [
                {
                  id: "portal-maintenance",
                  topic: "Maintenance du portail InfoService",
                  dateText: "À déterminer",
                  effect: "informational",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const MINIMAL_DATA: ImportantDatesData = {
  locale: "en",
  sourceUrl: "https://www.uottawa.ca/important-dates/2026-2027",
  terms: [
    {
      sourceId: "fall-2026",
      label: "Fall 2026",
      season: "fall",
      year: 2026,
      sourcePublished: "2026-03-01",
      termInterval: {
        startDate: "2026-09-01",
        endDate: "2026-12-31",
      },
      courseInterval: {
        startDate: "2026-09-08",
        endDate: "2026-12-09",
      },
      sessions: [],
      sections: [
        {
          id: "other",
          label: "Other",
          category: "other",
          groups: [
            {
              id: "other-items",
              items: [
                {
                  id: "orientation-note",
                  topic: "Orientation details",
                  dateText: "See website",
                  effect: "informational",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("important dates proto contract", () => {
  it("round-trips important dates data through proto + binary", () => {
    const wire = ProtoImportantDatesData.encode(toProtoImportantDatesData(FULL_DATA)).finish();
    const decoded = fromProtoImportantDatesData(ProtoImportantDatesData.decode(wire));

    expect(decoded).toStrictEqual(FULL_DATA);
  });

  it("omits optional fields when absent and restores them as undefined", () => {
    const proto = toProtoImportantDatesData(MINIMAL_DATA);

    expect(proto.reviewedText).toBeUndefined();
    expect(proto.terms[0]?.termId).toBeUndefined();
    expect(proto.terms[0]?.sections[0]?.groups[0]?.label).toBeUndefined();
    expect(proto.terms[0]?.sections[0]?.groups[0]?.items[0]?.interval).toBeUndefined();
    expect(proto.terms[0]?.sections[0]?.groups[0]?.items[0]?.replacement).toBeUndefined();
    expect(proto.terms[0]?.sections[0]?.groups[0]?.items[0]?.usedEnglishFallback).toBeUndefined();

    expect(fromProtoImportantDatesData(proto)).toStrictEqual(MINIMAL_DATA);
  });

  it("rejects unspecified proto enums on required fields", () => {
    const baseProto = toProtoImportantDatesData(MINIMAL_DATA);
    const baseTerm = baseProto.terms[0]!;
    const baseSection = baseTerm.sections[0]!;
    const baseGroup = baseSection.groups[0]!;
    const baseItem = baseGroup.items[0]!;

    const cases: Array<{
      label: string;
      proto: Parameters<typeof fromProtoImportantDatesData>[0];
    }> = [
      {
        label: "locale",
        proto: {
          ...baseProto,
          locale: ProtoImportantDatesLocale.IMPORTANT_DATES_LOCALE_UNSPECIFIED,
        },
      },
      {
        label: "season",
        proto: {
          ...baseProto,
          terms: [
            {
              ...baseTerm,
              season: ProtoImportantDateSeason.IMPORTANT_DATE_SEASON_UNSPECIFIED,
            },
          ],
        },
      },
      {
        label: "category",
        proto: {
          ...baseProto,
          terms: [
            {
              ...baseTerm,
              sections: [
                {
                  ...baseSection,
                  category: ProtoImportantDateCategory.IMPORTANT_DATE_CATEGORY_UNSPECIFIED,
                },
              ],
            },
          ],
        },
      },
      {
        label: "effect",
        proto: {
          ...baseProto,
          terms: [
            {
              ...baseTerm,
              sections: [
                {
                  ...baseSection,
                  groups: [
                    {
                      ...baseGroup,
                      items: [
                        {
                          ...baseItem,
                          effect: ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_UNSPECIFIED,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        label: "replacement source day",
        proto: {
          ...baseProto,
          terms: [
            {
              ...baseTerm,
              sections: [
                {
                  ...baseSection,
                  groups: [
                    {
                      ...baseGroup,
                      items: [
                        {
                          ...baseItem,
                          effect:
                            ProtoImportantDateEffect.IMPORTANT_DATE_EFFECT_SCHEDULE_REPLACEMENT,
                          replacement: {
                            cancelledYyyymmdd: 20260907,
                            replacementYyyymmdd: 20260909,
                            sourceDay: ProtoDayOfWeek.DAY_OF_WEEK_UNSPECIFIED,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ];

    for (const { label, proto } of cases) {
      expect(() => fromProtoImportantDatesData(proto)).toThrow(label);
    }
  });

  it("rejects an empty session code when encoding to proto", () => {
    const withEmptySessionCode: ImportantDatesData = {
      ...MINIMAL_DATA,
      terms: [
        {
          ...MINIMAL_DATA.terms[0]!,
          sessions: [
            {
              code: "",
              courseInterval: { startDate: "2026-09-08", endDate: "2026-10-01" },
            },
          ],
        },
      ],
    };

    expect(() => toProtoImportantDatesData(withEmptySessionCode)).toThrow(/session code/i);
  });

  it("rejects a session with a missing courseInterval when decoding from proto", () => {
    const proto = toProtoImportantDatesData(MINIMAL_DATA);
    const baseTerm = proto.terms[0]!;

    const withMissingSessionInterval = {
      ...proto,
      terms: [
        {
          ...baseTerm,
          sessions: [{ code: "A", courseInterval: undefined }],
        },
      ],
    };

    expect(() => fromProtoImportantDatesData(withMissingSessionInterval)).toThrow(
      /session courseInterval/i,
    );
  });
});
