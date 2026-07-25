import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { fromProtoImportantDatesData } from "@uoplan/core/dataTypes";
import type { ImportantDatesData } from "@uoplan/core/dataTypes";

const writtenFiles: Array<{ filePath: string; bytes: Uint8Array }> = [];
const readJsonMock = vi.fn<(filePath: string) => Promise<unknown>>();

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn(async () => {
      throw new Error("missing");
    }),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async (dir: string) => {
      if (dir.endsWith("/catalogue")) return [];
      if (dir.endsWith("/schedules")) return [];
      if (dir.endsWith("/data")) return [];
      return [];
    }),
    rm: vi.fn(async () => {}),
    readFile: vi.fn(async () => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }),
    writeFile: vi.fn(async (filePath: string, data: string | Uint8Array) => {
      if (data instanceof Uint8Array) {
        writtenFiles.push({ filePath, bytes: data });
      }
    }),
  },
}));

vi.mock("../shared/json.ts", () => ({
  readJson: readJsonMock,
}));

vi.mock("./grades.ts", () => ({
  mapDisciplinesJson: vi.fn(() => ({ disciplines: [], faculties: [] })),
  mapGradesJson: vi.fn(() => ({ sectionNames: [], courses: [] })),
}));

vi.mock("./feedback.ts", () => ({
  buildFeedbackData: vi.fn(async () => null),
}));

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

function defaultJsonFor(filePath: string): unknown {
  const fileName = path.basename(filePath);
  switch (fileName) {
    case "catalogue.json":
      return { years: [] };
    case "terms.json":
      return { terms: [] };
    case "indices.json":
      return { courses: [], programs: [], disciplines: [] };
    case "ratemyprofessors.json":
      return { resultCount: 0, professors: [] };
    case "disciplines.json":
      return { disciplines: [], faculties: [] };
    case "grades.json":
      return [];
    case "professors.json":
      return { professors: [] };
    case "important-dates.en.json":
      return importantDatesEn;
    case "important-dates.fr.json":
      return importantDatesFr;
    default:
      throw new Error(`Unexpected readJson path: ${filePath}`);
  }
}

async function importBuildModule() {
  writtenFiles.length = 0;
  readJsonMock.mockImplementation(async (filePath) => defaultJsonFor(filePath));
  vi.resetModules();
  return import("./build.ts");
}

describe("proto build important dates output", () => {
  it("writes separate important-dates.en.pb and important-dates.fr.pb runtime assets", async () => {
    const { main } = await importBuildModule();

    writtenFiles.length = 0;
    await main();

    const byFile = new Map(
      writtenFiles.map((entry) => [path.basename(entry.filePath), entry.bytes]),
    );
    expect(byFile.has("important-dates.en.pb")).toBe(true);
    expect(byFile.has("important-dates.fr.pb")).toBe(true);

    const decodedEn = fromProtoImportantDatesData(
      DataProto.ImportantDatesData.decode(byFile.get("important-dates.en.pb")!),
    );
    const decodedFr = fromProtoImportantDatesData(
      DataProto.ImportantDatesData.decode(byFile.get("important-dates.fr.pb")!),
    );

    expect(decodedEn.locale).toBe("en");
    expect(decodedEn.terms[0]?.sections[0]?.groups[0]?.items[0]?.topic).toBe(
      "Course selection opens",
    );
    expect(decodedFr.locale).toBe("fr-CA");
    expect(decodedFr.terms[0]?.sections[0]?.groups[0]?.items[0]?.topic).toBe(
      "Début du choix de cours",
    );
  });

  it("skips an important-dates locale asset when its source file is missing", async () => {
    const missing = new Error("ENOENT: missing important-dates.fr.json");
    Object.assign(missing, { code: "ENOENT" });
    readJsonMock.mockImplementation(async (filePath) => {
      if (path.basename(filePath) === "important-dates.fr.json") throw missing;
      return defaultJsonFor(filePath);
    });
    vi.resetModules();
    const { main } = await import("./build.ts");

    writtenFiles.length = 0;
    await expect(main()).resolves.toBeUndefined();
    const byFile = new Map(
      writtenFiles.map((entry) => [path.basename(entry.filePath), entry.bytes]),
    );
    expect(byFile.has("important-dates.en.pb")).toBe(true);
    expect(byFile.has("important-dates.fr.pb")).toBe(false);
  });
});
