import fs from "node:fs/promises";
import path from "node:path";
import got from "got";
import * as cheerio from "cheerio";
import { SCRAPER_DATA_DIR } from "./dataPaths.ts";

const DISCIPLINES_URL_EN = "https://catalogue.uottawa.ca/en/courses/";
const DISCIPLINES_URL_FR = "https://catalogue.uottawa.ca/fr/cours/";
const CODE_IN_PARENS_REGEX = /\(([A-Z]{3,4})\)/;

type DisciplineRow = {
  code: string;
  name: string;
  nameFr?: string;
};

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function parseDisciplineFromLabel(label: string): { code: string; name: string } | null {
  const normalized = normalizeLabel(label);
  const codeMatch = normalized.match(CODE_IN_PARENS_REGEX);
  if (!codeMatch?.[1]) return null;

  const code = codeMatch[1].toUpperCase();
  const name = normalized.replace(CODE_IN_PARENS_REGEX, "").replace(/\s+/g, " ").trim();
  if (!name) return null;

  return { code, name };
}

async function scrapeDisciplinesFromUrl(url: string): Promise<Map<string, string>> {
  const html = await got(url).text();
  const $ = cheerio.load(html);
  const byCode = new Map<string, string>();

  $("a").each((_, el) => {
    const raw = $(el).text();
    const parsed = parseDisciplineFromLabel(raw);
    if (!parsed) return;
    byCode.set(parsed.code, parsed.name);
  });

  return byCode;
}

async function scrapeDisciplines(): Promise<DisciplineRow[]> {
  const [enMap, frMap] = await Promise.all([
    scrapeDisciplinesFromUrl(DISCIPLINES_URL_EN),
    scrapeDisciplinesFromUrl(DISCIPLINES_URL_FR),
  ]);

  // Merge: English is authoritative for the code list, French fills in nameFr
  const rows: DisciplineRow[] = [];
  for (const [code, name] of enMap) {
    const nameFr = frMap.get(code);
    rows.push({ code, name, ...(nameFr ? { nameFr } : {}) });
  }

  // Also add any codes that only exist in French (edge case)
  for (const [code, nameFr] of frMap) {
    if (!enMap.has(code)) {
      rows.push({ code, name: nameFr, nameFr });
    }
  }

  return rows.sort((a, b) => a.code.localeCompare(b.code, "en"));
}

async function main(): Promise<void> {
  const disciplines = await scrapeDisciplines();
  if (disciplines.length === 0) {
    throw new Error("No disciplines were parsed from the uOttawa courses page");
  }

  const outPath = path.join(SCRAPER_DATA_DIR, "disciplines.json");
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        sources: [DISCIPLINES_URL_EN, DISCIPLINES_URL_FR],
        count: disciplines.length,
        disciplines,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote ${disciplines.length} disciplines to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed to scrape disciplines");
  console.error(err);
  process.exit(1);
});
