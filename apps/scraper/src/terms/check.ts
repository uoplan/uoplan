import fs from "fs/promises";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { bootstrapPeopleSoft, PEOPLESOFT_CLASS_SEARCH_URL } from "../shared/peoplesoft.ts";

const TERMS_JSON = path.join(SCRAPER_DATA_DIR, "terms.json");
const SEARCH_URL = PEOPLESOFT_CLASS_SEARCH_URL;

export type Term = { termId: string; name: string };

export function sortTerms(terms: Term[]): Term[] {
  return [...terms].sort((a, b) => a.termId.localeCompare(b.termId));
}

export function findNewTerms(known: Term[], current: Term[]): Term[] {
  const knownIds = new Set(known.map((t) => t.termId));
  return current.filter((t) => !knownIds.has(t.termId));
}

export function termsListsEqual(a: Term[], b: Term[]): boolean {
  const sortedA = sortTerms(a);
  const sortedB = sortTerms(b);
  if (sortedA.length !== sortedB.length) return false;
  return sortedA.every((t, i) => t.termId === sortedB[i].termId && t.name === sortedB[i].name);
}

export function parseTermDropdown(html: string): Term[] {
  const $ = cheerio.load(html);
  const select = $("#CLASS_SRCH_WRK2_STRM\\$35\\$");
  const terms: Term[] = [];
  select.find("option").each((_, opt) => {
    const termId = ($(opt).attr("value") ?? "").trim();
    const name = $(opt).text().replace(/\s+/g, " ").trim();
    if (termId && name) terms.push({ termId, name });
  });
  const seen = new Set<string>();
  return terms.filter((t) => {
    if (seen.has(t.termId)) return false;
    seen.add(t.termId);
    return true;
  });
}

async function fetchTerms(): Promise<Term[]> {
  const { value } = await bootstrapPeopleSoft(
    SEARCH_URL,
    (html) => {
      const terms = parseTermDropdown(html);
      return terms.length > 0 ? terms : null;
    },
    (preview) =>
      new Error(`Term dropdown not found after 10 attempts. First 400 chars: ${preview}`),
  );
  return value;
}
export async function main() {
  const currentTerms = await fetchTerms();

  const raw = await fs.readFile(TERMS_JSON, "utf8");
  const { terms: knownTerms } = JSON.parse(raw) as { terms: Term[] };

  const newTerms = findNewTerms(knownTerms, currentTerms);
  const sorted = sortTerms(currentTerms);

  if (!termsListsEqual(knownTerms, sorted)) {
    await fs.writeFile(TERMS_JSON, JSON.stringify({ terms: sorted }, null, 2) + "\n", "utf-8");
  }

  console.log(JSON.stringify(newTerms));
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
