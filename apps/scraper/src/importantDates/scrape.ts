import fs from "node:fs/promises";
import path from "node:path";
import type { ImportantDatesData } from "@uoplan/core/dataTypes";
import { fetchHtml } from "../shared/http.ts";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { parseImportantDatesPages } from "./parse.ts";

const IMPORTANT_DATES_EN_URL = "https://www.uottawa.ca/study/important-academic-dates-deadlines";
const IMPORTANT_DATES_FR_URL =
  "https://www.uottawa.ca/etudes/dates-importantes-echeances-scolaires";

const IMPORTANT_DATES_EN_FILE = path.join(SCRAPER_DATA_DIR, "important-dates.en.json");
const IMPORTANT_DATES_FR_FILE = path.join(SCRAPER_DATA_DIR, "important-dates.fr.json");

export type ImportantDatesScrapeResult = {
  en: ImportantDatesData;
  fr: ImportantDatesData;
  termCount: number;
  itemCount: number;
};

export async function scrapeImportantDates(): Promise<ImportantDatesScrapeResult> {
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

  await fs.mkdir(SCRAPER_DATA_DIR, { recursive: true });
  await Promise.all([
    writeJsonAtomically(IMPORTANT_DATES_EN_FILE, parsed.en),
    writeJsonAtomically(IMPORTANT_DATES_FR_FILE, parsed.fr),
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
