import fs from "fs/promises";
import path from "path";
import { urlToSlug } from "./links.ts";
import { CatalogueSchema } from "./schema.ts";

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

export async function generateIndices(dataDir: string): Promise<void> {
  const indicesPath = path.join(dataDir, "indices.json");
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

  const dirEntries = await fs.readdir(dataDir);
  const catalogueYears = dirEntries
    .map((name) => {
      const m = CATALOGUE_JSON_RE.exec(name);
      return m ? Number(m[1]) : null;
    })
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);

  const seenCourses = new Set(existingCourses);
  const coursesOut = [...existingCourses];
  const seenPrograms = new Set(existingPrograms);
  const programsOut = [...existingPrograms];

  for (const y of catalogueYears) {
    const raw = await fs.readFile(path.join(dataDir, `catalogue.${y}.json`), "utf-8");
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
  await fs.writeFile(
    indicesPath,
    JSON.stringify({ courses: coursesOut, programs: programsOut }, null, 2),
    "utf-8",
  );
  console.log(
    `\nWrote indices.json (${coursesOut.length} courses, ${programsOut.length} programs; +${newCourses} courses, +${newPrograms} programs appended from ${catalogueYears.length} catalogue file(s))`,
  );
}
