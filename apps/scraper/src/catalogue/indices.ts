import fs from "node:fs/promises";
import path from "node:path";
import { urlToSlug } from "./links.ts";
import { CatalogueSchema } from "./schema.ts";
import { CATALOGUE_DATA_DIR, SCRAPER_DATA_DIR } from "../shared/paths.ts";

function parseIndicesStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export function parseMissingByYear(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [year, urls] of Object.entries(value)) {
    out[year] = parseIndicesStringArray(urls);
  }
  return out;
}

const CATALOGUE_JSON_RE = /^catalogue\.(\d{4})\.json$/;

export function parseCatalogueYears(
  dirEntries: string[],
  sortOrder: "ascending" | "descending" = "ascending",
): number[] {
  return dirEntries
    .map((name) => {
      const m = CATALOGUE_JSON_RE.exec(name);
      return m ? Number(m[1]) : null;
    })
    .filter((y): y is number => y !== null)
    .sort((a, b) => (sortOrder === "ascending" ? a - b : b - a));
}

export async function generateIndices(): Promise<void> {
  const indicesPath = path.join(SCRAPER_DATA_DIR, "indices.json");
  let existingCourses: string[] = [];
  let existingPrograms: string[] = [];
  try {
    const rawExisting = await fs.readFile(indicesPath, "utf-8");
    const parsed: unknown = JSON.parse(rawExisting);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      existingCourses = parseIndicesStringArray(o.courses);
      existingPrograms = parseIndicesStringArray(o.programs);
    }
  } catch {
    // Missing or unreadable file — start fresh
  }

  const dirEntries = await fs.readdir(CATALOGUE_DATA_DIR);
  const catalogueYears = parseCatalogueYears(dirEntries);

  const seenCourses = new Set(existingCourses);
  const coursesOut = [...existingCourses];
  const seenPrograms = new Set(existingPrograms);
  const programsOut = [...existingPrograms];

  for (const y of catalogueYears) {
    const raw = await fs.readFile(path.join(CATALOGUE_DATA_DIR, `catalogue.${y}.json`), "utf-8");
    const catalogue = CatalogueSchema.parse(JSON.parse(raw) as unknown);
    for (const c of catalogue.courses) {
      const code = c.code;
      if (!seenCourses.has(code)) {
        seenCourses.add(code);
        coursesOut.push(code);
      }
    }
    for (const p of catalogue.programs) {
      const slug = p.slug ?? urlToSlug(p.url);
      if (!seenPrograms.has(slug)) {
        seenPrograms.add(slug);
        programsOut.push(slug);
      }
    }
  }

  const newCourses = coursesOut.length - existingCourses.length;
  const newPrograms = programsOut.length - existingPrograms.length;

  // Derive the discipline dictionary (distinct 3-letter subject prefixes) in
  // first-occurrence order over the append-ordered course list. Stored in
  // indices.json for the domain/state index space and used by the columnar
  // indices.pb encoder.
  const disciplinesOut: string[] = [];
  const seenDisciplines = new Set<string>();
  for (const code of coursesOut) {
    const disc = /^([A-Za-z]+) /.exec(code)?.[1];
    if (disc !== undefined && !seenDisciplines.has(disc)) {
      seenDisciplines.add(disc);
      disciplinesOut.push(disc);
    }
  }
  await fs.writeFile(
    indicesPath,
    JSON.stringify(
      { courses: coursesOut, programs: programsOut, disciplines: disciplinesOut },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(
    `\nWrote indices.json (${coursesOut.length} courses, ${programsOut.length} programs, ${disciplinesOut.length} disciplines; +${newCourses} courses, +${newPrograms} programs appended from ${catalogueYears.length} catalogue file(s))`,
  );
}
