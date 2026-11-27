import fs from "node:fs/promises";
import path from "node:path";
import type { ImportantDatesData } from "@uoplan/core/dataTypes";
import type { SchoolId } from "@uoplan/domain/school";
import { fetchHtml } from "../shared/http.ts";
import { scraperDataDir } from "../shared/paths.ts";
import { writeCarletonImportantDates } from "../schools/carleton/importantDates.ts";
import { parseImportantDatesPages } from "./parse.ts";
import { extractTermPageLinks } from "./parseExtract.ts";
import type { TermPageInput } from "./parseTypes.ts";

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

  const [enIndexHtml, frIndexHtml] = await Promise.all([
    fetchHtml(IMPORTANT_DATES_EN_URL),
    fetchHtml(IMPORTANT_DATES_FR_URL),
  ]);

  // uOttawa publishes one page per term; pair the EN/FR pages by (season, year).
  const enLinks = extractTermPageLinks(enIndexHtml, IMPORTANT_DATES_EN_URL);
  const frLinks = extractTermPageLinks(frIndexHtml, IMPORTANT_DATES_FR_URL);
  const frByKey = new Map(frLinks.map((url) => [termKeyFromUrl(url), url]));

  const enPages: TermPageInput[] = [];
  const frPages: TermPageInput[] = [];
  await Promise.all(
    enLinks.map(async (enUrl) => {
      const key = termKeyFromUrl(enUrl);
      const frUrl = frByKey.get(key);
      if (!frUrl) throw new Error(`No French important-dates page for ${enUrl}`);
      const [enHtml, frHtml] = await Promise.all([fetchHtml(enUrl), fetchHtml(frUrl)]);
      enPages.push({ sourceId: key, sourceUrl: enUrl, html: enHtml });
      frPages.push({ sourceId: key, sourceUrl: frUrl, html: frHtml });
    }),
  );

  const parsed = parseImportantDatesPages({
    enPages,
    frPages,
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

const FR_SEASON_TO_EN: Record<string, string> = {
  hiver: "winter",
  automne: "fall",
  "printemps-ete": "spring-summer",
};

/** Locale-independent term key from a page URL: `fall-2026`, `spring-summer-2027`, … */
function termKeyFromUrl(url: string): string {
  const slug = new URL(url).pathname.split("/").pop() ?? "";
  const match = /^(.+)-(\d{4})$/.exec(slug);
  if (!match) throw new Error(`Unrecognised important-dates term page URL: ${url}`);
  return `${FR_SEASON_TO_EN[match[1]] ?? match[1]}-${match[2]}`;
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
