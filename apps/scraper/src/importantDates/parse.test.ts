import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseImportantDatesPages } from "./parse.ts";

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const EN_URL = "https://www.uottawa.ca/study/important-academic-dates-deadlines";
const FR_URL = "https://www.uottawa.ca/etudes/dates-importantes-echeances-scolaires";

async function loadFixturePair() {
  const [enHtml, frHtml] = await Promise.all([
    fs.readFile(path.join(FIXTURE_DIR, "important-dates.en.html"), "utf-8"),
    fs.readFile(path.join(FIXTURE_DIR, "important-dates.fr.html"), "utf-8"),
  ]);
  return { enHtml, frHtml };
}

function replaceOnce(input: string, search: string, replacement: string): string {
  const output = input.replace(search, replacement);
  if (output === input) {
    throw new Error(`Expected fixture fragment not found: ${search}`);
  }
  return output;
}

describe("parseImportantDatesPages", () => {
  it("parses current and archived components into symmetric locale datasets", async () => {
    const { enHtml, frHtml } = await loadFixturePair();
    const parsed = parseImportantDatesPages({
      enHtml,
      frHtml,
      enSourceUrl: EN_URL,
      frSourceUrl: FR_URL,
    });

    expect(parsed.en.reviewedText).toBe("June 2026");
    expect(parsed.fr.reviewedText).toBe("Juin 2026");

    expect(parsed.en.terms.map((term) => term.sourceId)).toEqual([
      "9221_158086",
      "9221_157831",
      "9221_157886",
      "9221_157941",
    ]);
    expect(parsed.en.terms.map((term) => term.termId)).toEqual(["2245", "2261", "2265", "2269"]);
    expect(parsed.en.terms.map((term) => term.sourcePublished)).toEqual([
      "false",
      "true",
      "true",
      "true",
    ]);
    expect(parsed.en.terms.map((term) => term.label)).toEqual([
      "Spring-Summer 2024",
      "Winter 2026",
      "Spring-Summer 2026",
      "Fall 2026",
    ]);
    expect(parsed.fr.terms.map((term) => term.label)).toEqual([
      "Printemps-été 2024",
      "Hiver 2026",
      "Printemps-été 2026",
      "Automne 2026",
    ]);

    const summarize = (data: (typeof parsed)["en"]) =>
      data.terms.map((term) => ({
        sourceId: term.sourceId,
        sessions: term.sessions,
        sections: term.sections.map((section) => ({
          id: section.id,
          category: section.category,
          groups: section.groups.map((group) => ({
            id: group.id,
            sessionCode: group.sessionCode,
            itemIds: group.items.map((item) => item.id),
          })),
        })),
      }));

    expect(summarize(parsed.fr)).toEqual(summarize(parsed.en));

    const archived = parsed.en.terms[0];
    expect(archived.termInterval).toEqual({ startDate: "2024-05-01", endDate: "2024-08-31" });
    expect(archived.courseInterval).toEqual({ startDate: "2024-05-01", endDate: "2024-08-23" });
    expect(archived.sessions).toEqual([
      { code: "A", courseInterval: { startDate: "2024-05-01", endDate: "2024-07-23" } },
      { code: "B", courseInterval: { startDate: "2024-05-01", endDate: "2024-06-11" } },
      { code: "C", courseInterval: { startDate: "2024-06-17", endDate: "2024-07-26" } },
      { code: "D", courseInterval: { startDate: "2024-07-15", endDate: "2024-08-23" } },
    ]);

    const archivedEnrolment = archived.sections.find((section) => section.category === "enrolment");
    expect(archivedEnrolment?.groups.map((group) => group.label)).toEqual([
      undefined,
      "Session A (May 1 to July 23)",
      "Session B (May 1 to June 11)",
      "Session C (June 17 to July 26)",
      "Session D (July 15 to August 23)",
      "Session D (July 15 to August 23)",
    ]);
    expect(archivedEnrolment?.groups.map((group) => group.sessionCode)).toEqual([
      undefined,
      "A",
      "B",
      "C",
      "D",
      "D",
    ]);
    expect(archivedEnrolment?.groups[0]?.id).toBe("9221_158086:enrolment:g0");
    expect(archivedEnrolment?.groups[4]?.items[0]?.id).toBe("9221_158086:enrolment:g4:r0");

    const archivedBreaks = archived.sections.find((section) => section.category === "breaks");
    expect(archivedBreaks?.groups[0]?.items[0]).toMatchObject({
      id: "9221_158086:breaks:g0:r0",
      topic:
        "91st ACFAS Conference During this conference, all courses will be online and follow the regular schedule.",
      dateText: "May 13 to 17",
      effect: "informational",
      interval: { startDate: "2024-05-13", endDate: "2024-05-17" },
    });
    expect(archivedBreaks?.groups[0]?.sessionCode).toBeUndefined();

    const archivedTraining = archived.sections.find(
      (section) => section.category === "academic_integrity",
    );
    expect(archivedTraining?.label).toBe("Training on academic integrity (undergraduate studies)");

    const winter = parsed.en.terms[1];
    const winterOther = winter.sections.find((section) => section.category === "other");
    expect(winterOther?.label).toBe("Campus life notices");

    const springSummer = parsed.en.terms[2];
    expect(springSummer.termInterval).toEqual({ startDate: "2026-05-01", endDate: "2026-08-31" });
    expect(springSummer.courseInterval).toEqual({ startDate: "2026-05-04", endDate: "2026-07-31" });
    expect(springSummer.sessions).toEqual([
      { code: "A", courseInterval: { startDate: "2026-05-04", endDate: "2026-07-24" } },
      { code: "B", courseInterval: { startDate: "2026-05-04", endDate: "2026-06-12" } },
      { code: "C", courseInterval: { startDate: "2026-06-22", endDate: "2026-07-31" } },
    ]);

    const springSummerEnrolment = springSummer.sections.find(
      (section) => section.category === "enrolment",
    );
    expect(springSummerEnrolment?.groups.map((group) => group.label)).toEqual([
      undefined,
      "Session A (May 4 to July 24)",
      "Session B (May 4 to June 12)",
      "Session C (June 22 to July 31)",
    ]);
    expect(springSummerEnrolment?.groups.map((group) => group.sessionCode)).toEqual([
      undefined,
      "A",
      "B",
      "C",
    ]);

    const springSummerTuition = springSummer.sections.find(
      (section) => section.category === "tuition",
    );
    expect(springSummerTuition?.groups[0]?.items[0]?.topic).toBe(
      "Session A: Last day to pay tuition fees without late fees.",
    );
    expect(springSummerTuition?.groups[0]?.sessionCode).toBeUndefined();

    const springScheduleEn = springSummer.sections.find(
      (section) => section.category === "schedule_changes",
    )?.groups[0]?.items[0];
    expect(springScheduleEn).toMatchObject({
      id: "9221_157886:schedule_changes:g0:r0",
      effect: "schedule_replacement",
      interval: { startDate: "2026-05-23", endDate: "2026-05-23" },
      replacement: {
        cancelledDate: "2026-05-18",
        replacementDate: "2026-05-23",
        sourceDay: "Mo",
      },
    });

    const springScheduleFr = parsed.fr.terms[2].sections.find(
      (section) => section.category === "schedule_changes",
    )?.groups[0]?.items[0];
    expect(springScheduleFr).toMatchObject({
      id: "9221_157886:schedule_changes:g0:r0",
      topic:
        "Les cours du lundi 18 mai sont annulés et reportés au samedi 23 mai selon l’horaire normal du lundi.",
      dateText: "23 mai",
      effect: "schedule_replacement",
      interval: { startDate: "2026-05-23", endDate: "2026-05-23" },
      replacement: {
        cancelledDate: "2026-05-18",
        replacementDate: "2026-05-23",
        sourceDay: "Mo",
      },
    });

    const fallTrainingFr = parsed.fr.terms[3].sections.find(
      (section) => section.category === "academic_integrity",
    );
    expect(fallTrainingFr?.groups[0]?.items).toHaveLength(1);
    expect(fallTrainingFr?.groups[0]?.items[0]).toMatchObject({
      id: "9221_157941:academic_integrity:g0:r0",
      topic:
        "Date limite pour réussir la formation obligatoire sur l’intégrité dans les études (nouveaux étudiants en 2026)",
      dateText: "1er novembre",
    });

    const archivedFallback = parsed.fr.terms[0].sections.find(
      (section) => section.category === "enrolment",
    )?.groups[5]?.items[0];
    expect(archivedFallback).toMatchObject({
      id: "9221_158086:enrolment:g5:r0",
      topic:
        "All other sessions held between May 1 and August 31: Last day to withdraw from a course or an activity may vary.",
      dateText: "Consult your faculty or unit.",
      usedEnglishFallback: true,
      effect: "deadline",
    });
  });

  it("rejects unexpected current locale structural drift with contextual errors", async () => {
    const { enHtml, frHtml } = await loadFixturePair();
    const driftedFrHtml = replaceOnce(frHtml, "<td>15 mai</td>", "");

    expect(() =>
      parseImportantDatesPages({
        enHtml,
        frHtml: driftedFrHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/etudes\/dates-importantes-echeances-scolaires/i);
    expect(() =>
      parseImportantDatesPages({
        enHtml,
        frHtml: driftedFrHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/9221_157886/);
    expect(() =>
      parseImportantDatesPages({
        enHtml,
        frHtml: driftedFrHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/category=enrolment/i);
  });

  it("rejects unsupported current schedule-change prose instead of silently downgrading it", async () => {
    const { enHtml, frHtml } = await loadFixturePair();
    const unsupportedEnHtml = replaceOnce(
      enHtml,
      "Classes are cancelled on Monday, May 18, in lieu of Victoria Day\n                              (statutory holiday). They will be held on Saturday, May 23, when the\n                              usual Monday course schedule will apply.",
      "Classes are rescheduled. Please check with your professor for details.",
    );

    expect(() =>
      parseImportantDatesPages({
        enHtml: unsupportedEnHtml,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/unsupported current schedule-change/i);
    expect(() =>
      parseImportantDatesPages({
        enHtml: unsupportedEnHtml,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/9221_157886/);
  });

  it("rejects a scoped group referencing an undefined session for a currently published term", async () => {
    const { enHtml, frHtml } = await loadFixturePair();
    const enHtmlWithOrphanSession = replaceOnce(
      enHtml,
      `                      <h4>Session C (June 22 to July 31)</h4>
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>Dates</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Last day to enrol or change course selection</td>
                            <td>June 26</td>
                          </tr>
                        </tbody>
                      </table>`,
      `                      <h4>Session C (June 22 to July 31)</h4>
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>Dates</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Last day to enrol or change course selection</td>
                            <td>June 26</td>
                          </tr>
                        </tbody>
                      </table>

                      <h4>Session Z (August 1 to August 2)</h4>
                      <table class="table">
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>Dates</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Last day to enrol or change course selection</td>
                            <td>August 1</td>
                          </tr>
                        </tbody>
                      </table>`,
    );

    expect(() =>
      parseImportantDatesPages({
        enHtml: enHtmlWithOrphanSession,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/undefined session/i);
    expect(() =>
      parseImportantDatesPages({
        enHtml: enHtmlWithOrphanSession,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/"Z"/);
    expect(() =>
      parseImportantDatesPages({
        enHtml: enHtmlWithOrphanSession,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/9221_157886/);
    expect(() =>
      parseImportantDatesPages({
        enHtml: enHtmlWithOrphanSession,
        frHtml,
        enSourceUrl: EN_URL,
        frSourceUrl: FR_URL,
      }),
    ).toThrow(/category=enrolment/i);
  });
});
