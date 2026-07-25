import fs from "node:fs/promises";
import * as cheerio from "cheerio";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SchoolId } from "@uoplan/domain/school";
import { scraperDataDir } from "../shared/paths.ts";
import { bootstrapPeopleSoft, PEOPLESOFT_CLASS_SEARCH_URL } from "../shared/peoplesoft.ts";
import { CarletonBannerClient } from "../schools/carleton/banner/client.ts";
import { parseTerms as parseCarletonTerms } from "../schools/carleton/banner/parseTerms.ts";
import { normalizeTermName } from "./normalize.ts";

const SEARCH_URL = PEOPLESOFT_CLASS_SEARCH_URL;

type Term = { termId: string; name: string };

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
    const name = normalizeTermName($(opt).text().replaceAll(/\s+/g, " ").trim());
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

export type FetchCurrentTermsDeps = {
  fetchUottawaTerms?: () => Promise<Term[]>;
  fetchCarletonSelectTermHtml?: () => Promise<string>;
};

export async function fetchCurrentTermsForSchool(
  school: SchoolId,
  deps: FetchCurrentTermsDeps = {},
): Promise<Term[]> {
  if (school === "carleton") {
    const html =
      deps.fetchCarletonSelectTermHtml == null
        ? await new CarletonBannerClient().fetchSelectTerm()
        : await deps.fetchCarletonSelectTermHtml();
    return parseCarletonTerms(html).terms;
  }
  return deps.fetchUottawaTerms == null ? fetchTerms() : deps.fetchUottawaTerms();
}

export async function main(school: SchoolId): Promise<void> {
  const currentTerms = await fetchCurrentTermsForSchool(school);

  const termsJson = path.join(scraperDataDir(school), "terms.json");
  let knownTerms: Term[] = [];
  try {
    const raw = await fs.readFile(termsJson, "utf8");
    knownTerms = (JSON.parse(raw) as { terms: Term[] }).terms;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;
  }

  const newTerms = findNewTerms(knownTerms, currentTerms);
  const sorted = sortTerms(currentTerms);

  if (!termsListsEqual(knownTerms, sorted)) {
    await fs.mkdir(path.dirname(termsJson), { recursive: true });
    await fs.writeFile(termsJson, `${JSON.stringify({ terms: sorted }, null, 2)}\n`, "utf-8");
  }

  console.log(JSON.stringify(newTerms));
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { parseSchoolArg } = await import("../shared/cliSchool.ts");
  await main(parseSchoolArg(process.argv));
}
