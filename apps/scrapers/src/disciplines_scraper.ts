import fs from "node:fs/promises";
import path from "node:path";
import got from "got";
import * as cheerio from "cheerio";
import { SCRAPER_DATA_DIR } from "./dataPaths.ts";

const DISCIPLINES_URL = "https://catalogue.uottawa.ca/en/courses/";
const CODE_IN_PARENS_REGEX = /\(([A-Z]{3,4})\)/;

type DisciplineRow = {
  code: string;
  name: string;
};

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function parseDisciplineFromLabel(label: string): DisciplineRow | null {
  const normalized = normalizeLabel(label);
  const codeMatch = normalized.match(CODE_IN_PARENS_REGEX);
  if (!codeMatch?.[1]) return null;

  const code = codeMatch[1].toUpperCase();
  const name = normalized.replace(CODE_IN_PARENS_REGEX, "").replace(/\s+/g, " ").trim();
  if (!name) return null;

  return { code, name };
}

async function scrapeDisciplines(): Promise<DisciplineRow[]> {
  const html = await got(DISCIPLINES_URL).text();
  const $ = cheerio.load(html);
  const rows = new Map<string, DisciplineRow>();

  $("a").each((_, el) => {
    const raw = $(el).text();
    const parsed = parseDisciplineFromLabel(raw);
    if (!parsed) return;
    rows.set(parsed.code, parsed);
  });

  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
}

async function main(): Promise<void> {
  const disciplines = await scrapeDisciplines();
  if (disciplines.length === 0) {
    throw new Error("No disciplines were parsed from the uOttawa courses page");
  }

  const outPath = path.join(SCRAPER_DATA_DIR, "disciplines.json");
  await fs.writeFile(
    outPath,
    JSON.stringify({ source: DISCIPLINES_URL, count: disciplines.length, disciplines }, null, 2),
    "utf8",
  );
  console.log(`Wrote ${disciplines.length} disciplines to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed to scrape disciplines");
  console.error(err);
  process.exit(1);
});
