import fs from "node:fs/promises";
import path from "node:path";
import type { ImportantDatesData } from "@uoplan/core/dataTypes";
import type { SchoolId } from "@uoplan/domain/school";
import { fetchHtml } from "../shared/http.ts";
import { scraperDataDir } from "../shared/paths.ts";
import { writeCarletonImportantDates } from "../schools/carleton/importantDates.ts";
import { parseImportantDatesPages } from "./parse.ts";

const IMPORTANT_DATES_EN_URL = "https://www.uottawa.ca/study/important-academic-dates-deadlines";
const IMPORTANT_DATES_FR_URL =
  "https://www.uottawa.ca/etudes/dates-importantes-echeances-scolaires";

export type ImportantDatesScrapeResult = {
  en: ImportantDatesData;
  fr: ImportantDatesData;
  termCount: number;
  itemCount: number;
};

export async function scrapeImportantDates(school: SchoolId): Promise<ImportantDatesScrapeResult> {
  if (school === "carleton") {
    const parsed = await writeCarletonImportantDates();
    return {
      en: parsed.en,
      fr: parsed.fr,
      termCount: parsed.en.terms.length,
      itemCount: countItems(parsed.en),
    };
  }

  const [enHtml, frHtml] = await Promise.all([
    fetchHtml(IMPORTANT_DATES_EN_URL),
    fetchHtml(IMPORTANT_DATES_FR_URL),
  ]);

  const parsed = parseImportantDatesPages({
    enHtml,
    frHtml,
    enSourceUrl: IMPORTANT_DATES_EN_URL,
    frSourceUrl: IMPORTANT_DATES_FR_URL,
  });

  const dataDir = scraperDataDir(school);
  await fs.mkdir(dataDir, { recursive: true });
  await Promise.all([
    writeJsonAtomically(path.join(dataDir, "important-dates.en.json"), parsed.en),
    writeJsonAtomically(path.join(dataDir, "important-dates.fr.json"), parsed.fr),
  ]);

  return {
    en: parsed.en,
    fr: parsed.fr,
    termCount: parsed.en.terms.length,
    itemCount: countItems(parsed.en),
  };
}

function countItems(data: ImportantDatesData): number {
  return data.terms.reduce(
    (termCount, term) =>
      termCount +
      term.sections.reduce(
        (sectionCount, section) =>
          sectionCount +
          section.groups.reduce((groupCount, group) => groupCount + group.items.length, 0),
        0,
      ),
    0,
  );
}

async function writeJsonAtomically(filePath: string, data: ImportantDatesData): Promise<void> {
  const nextPath = `${filePath}.next`;
  const json = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(nextPath, json, "utf-8");
  await fs.rename(nextPath, filePath);
}
