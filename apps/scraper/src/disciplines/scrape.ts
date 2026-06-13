import fs from "node:fs/promises";
import path from "node:path";
import got from "got";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { extractFacultyFromHeading, facultyIdFromName } from "@uoplan/core/facultyIdentity";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";

const ROOT_URL = "https://catalogue.uottawa.ca";
const DISCIPLINES_URL_EN = `${ROOT_URL}/en/courses/`;
const DISCIPLINES_URL_FR = `${ROOT_URL}/fr/cours/`;
const CODE_IN_PARENS_REGEX = /\(([A-Z]{3,4})\)/;

type DisciplineRow = {
  code: string;
  name: string;
  nameFr?: string;
  /** Stable faculty id (see `faculties`), or absent when the catalogue page lists none. */
  faculty?: string;
};

type FacultyRow = {
  id: string;
  name: string;
  nameFr?: string;
};

function normalizeLabel(label: string): string {
  return label.replaceAll(/\s+/g, " ").trim();
}

function parseDisciplineFromLabel(label: string): { code: string; name: string } | null {
  const normalized = normalizeLabel(label);
  const codeMatch = normalized.match(CODE_IN_PARENS_REGEX);
  if (!codeMatch?.[1]) return null;

  const code = codeMatch[1].toUpperCase();
  const name = normalized.replace(CODE_IN_PARENS_REGEX, "").replaceAll(/\s+/g, " ").trim();
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

/**
 * Read the per-discipline catalogue page and extract the faculty named in its
 * `#textcontainer` `<h2>` ("Courses in … are offered by <FACULTY>" /
 * "Les cours … sont offerts par <FACULTY>"). Returns null on a 404 / missing
 * heading so a single discipline never aborts the whole scrape.
 */
async function fetchFacultyHeading(url: string, locale: "en" | "fr"): Promise<string | null> {
  let html: string;
  try {
    html = await got(url).text();
  } catch {
    return null;
  }
  const $ = cheerio.load(html);
  const heading = $("#textcontainer").children("h2").first().text();
  if (!heading) return null;
  return extractFacultyFromHeading(heading, locale);
}

async function fetchFacultyForCode(code: string): Promise<{ nameEn?: string; nameFr?: string }> {
  const lower = code.toLowerCase();
  const [nameEn, nameFr] = await Promise.all([
    fetchFacultyHeading(`${ROOT_URL}/en/courses/${lower}/`, "en"),
    fetchFacultyHeading(`${ROOT_URL}/fr/cours/${lower}/`, "fr"),
  ]);
  return { ...(nameEn ? { nameEn } : {}), ...(nameFr ? { nameFr } : {}) };
}

async function scrapeDisciplines(): Promise<{
  faculties: FacultyRow[];
  disciplines: DisciplineRow[];
}> {
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

  // Fetch the offering faculty for each discipline from its own catalogue page.
  // The English name drives the stable faculty id so a faculty's English short
  // form ("Science") and full form ("Faculty of Science") collapse together.
  // We tally every (en/fr) display name seen for an id and pick the most common
  // one, so a stray catalogue variant ("Faculty of Sciences") never wins over the
  // canonical name shared by the rest of the faculty's disciplines.
  const limit = pLimit(10);
  const enNameCounts = new Map<string, Map<string, number>>();
  const frNameCounts = new Map<string, Map<string, number>>();
  const tally = (counts: Map<string, Map<string, number>>, id: string, name: string) => {
    const inner = counts.get(id) ?? new Map<string, number>();
    inner.set(name, (inner.get(name) ?? 0) + 1);
    counts.set(id, inner);
  };
  await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const faculty = await fetchFacultyForCode(row.code);
        if (!faculty.nameEn) return;
        const id = facultyIdFromName(faculty.nameEn);
        if (!id) return;
        row.faculty = id;
        tally(enNameCounts, id, faculty.nameEn);
        if (faculty.nameFr) tally(frNameCounts, id, faculty.nameFr);
      }),
    ),
  );

  // The winning display name is the most frequent, tie-broken alphabetically for
  // determinism.
  const pickName = (counts: Map<string, number> | undefined): string | undefined => {
    if (!counts) return undefined;
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
    )[0]?.[0];
  };

  const faculties: FacultyRow[] = [...enNameCounts.keys()]
    .map((id) => {
      const name = pickName(enNameCounts.get(id));
      const nameFr = pickName(frNameCounts.get(id));
      if (!name) return null;
      return { id, name, ...(nameFr ? { nameFr } : {}) };
    })
    .filter((row): row is FacultyRow => row != null)
    .sort((a, b) => a.id.localeCompare(b.id, "en"));

  const disciplines = rows.sort((a, b) => a.code.localeCompare(b.code, "en"));
  return { faculties, disciplines };
}

export async function main(): Promise<void> {
  const { faculties, disciplines } = await scrapeDisciplines();
  if (disciplines.length === 0) {
    throw new Error("No disciplines were parsed from the uOttawa courses page");
  }

  const disciplinesPath = path.join(SCRAPER_DATA_DIR, "disciplines.json");
  await fs.writeFile(
    disciplinesPath,
    JSON.stringify(
      {
        sources: [DISCIPLINES_URL_EN, DISCIPLINES_URL_FR],
        count: disciplines.length,
        faculties,
        disciplines,
      },
      null,
      2,
    ),
    "utf8",
  );
  const withFaculty = disciplines.filter((d) => d.faculty).length;
  console.log(
    `Wrote ${disciplines.length} disciplines (${withFaculty} with faculty) and ${faculties.length} faculties to ${disciplinesPath}`,
  );

  const indicesPath = path.join(SCRAPER_DATA_DIR, "indices.json");
  let indices: Record<string, unknown> = {};
  try {
    indices = JSON.parse(await fs.readFile(indicesPath, "utf-8")) as Record<string, unknown>;
  } catch {
    // Missing or unreadable — will be created on next catalogue scrape
  }
  const existingCodes: string[] = Array.isArray(indices.disciplines)
    ? (indices.disciplines as string[])
    : [];
  const seen = new Set(existingCodes);
  const appended: string[] = [];
  for (const d of disciplines) {
    if (!seen.has(d.code)) {
      seen.add(d.code);
      existingCodes.push(d.code);
      appended.push(d.code);
    }
  }
  indices.disciplines = existingCodes;
  await fs.writeFile(indicesPath, JSON.stringify(indices, null, 2), "utf-8");
  console.log(
    `Updated indices.json with ${existingCodes.length} discipline codes (+${appended.length} new)`,
  );
}
