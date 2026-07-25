import fs from "node:fs/promises";
import path from "node:path";
import { SCHOOLS } from "@uoplan/domain/school";
import {
  generateIndices,
  parseCatalogueYears,
  parseMissingByYear,
} from "../../catalogue/indices.ts";
import { getCurrentAcademicYear } from "../../catalogue/links.ts";
import { catalogueDataDir } from "../../shared/paths.ts";
import { scrapeCarletonCatalogue } from "./calendar/scrapeCatalogue.ts";

/**
 * Return the archive year slug that Carleton's calendar site uses for the
 * academic year beginning in `calYear`.
 *
 * CourseLeaf archives pre-2014 use a two-digit short-year suffix
 * (`2013-14`, `2012-13`), while 2014 onward use the full four-digit form
 * (`2014-2015`). Years 2011 and earlier live on a legacy domain
 * (`www3.carleton.ca`) with a completely different HTML structure, so they
 * are not scrapeable with the CourseLeaf parser and return `null`.
 */
export function carletonArchiveYearSlug(calYear: number): string | null {
  if (calYear <= 2011) return null;
  if (calYear === 2012) return "2012-13";
  if (calYear === 2013) return "2013-14";
  return `${calYear}-${calYear + 1}`;
}

async function writeYear(year: number, force: boolean, archiveYear?: string): Promise<string[]> {
  const dataDir = catalogueDataDir("carleton");
  const outPath = path.join(dataDir, `catalogue.${year}.json`);
  if (!force) {
    try {
      await fs.access(outPath);
      console.log(`Skipping catalogue.${year}.json (already exists)`);
      return [];
    } catch {
      // Missing file should be scraped.
    }
  }

  const result = await scrapeCarletonCatalogue({ year: archiveYear });

  if (result.catalogue.courses.length === 0) {
    // An empty result — upstream 404/redirect or a layout the parser doesn't
    // handle — must not be written to disk. An empty year file is worse than
    // an absent one because it ships as a real catalogue year in the UI's year
    // picker with zero courses.
    console.log(
      `Skipping catalogue.${year}.json: scrape returned 0 courses (${result.report.misses.length} misses)`,
    );
    return result.report.misses.map((miss) => miss.url).sort();
  }

  await fs.writeFile(outPath, `${JSON.stringify(result.catalogue, null, 2)}\n`, "utf-8");
  console.log(
    `Saved catalogue.${year}.json (${result.catalogue.courses.length} courses, ${result.catalogue.programs.length} programs)`,
  );
  return result.report.misses.map((miss) => miss.url).sort();
}

export async function scrapeCarletonCatalogueCli(force: boolean): Promise<void> {
  const dataDir = catalogueDataDir("carleton");
  await fs.mkdir(dataDir, { recursive: true });
  const academicYear = getCurrentAcademicYear();
  const calendarYear = new Date().getFullYear();
  const missingPath = path.join(dataDir, "catalogue.missing.json");
  let missingByYear: Record<string, string[]> = {};
  try {
    missingByYear = parseMissingByYear(
      JSON.parse(await fs.readFile(missingPath, "utf-8")) as unknown,
    );
  } catch {
    // Missing log starts empty.
  }

  for (let year = SCHOOLS.carleton.oldestCatalogueYear; year < academicYear; year++) {
    const archiveYearSlug = carletonArchiveYearSlug(year);
    if (archiveYearSlug === null) {
      // Year is on a legacy system — not scrapeable with the CourseLeaf parser.
      continue;
    }
    const missing = await writeYear(year, force, archiveYearSlug);
    if (missing.length > 0) missingByYear[String(year)] = missing;
  }

  const liveMissing = await writeYear(academicYear, true);
  if (liveMissing.length > 0) missingByYear[String(academicYear)] = liveMissing;
  else delete missingByYear[String(academicYear)];

  if (calendarYear !== academicYear) {
    const srcPath = path.join(dataDir, `catalogue.${academicYear}.json`);
    const dstPath = path.join(dataDir, `catalogue.${calendarYear}.json`);
    await fs.copyFile(srcPath, dstPath);
    console.log(`\nCopied catalogue.${academicYear}.json → catalogue.${calendarYear}.json`);
  }

  await fs.writeFile(missingPath, `${JSON.stringify(missingByYear, null, 2)}\n`, "utf-8");
  const dirEntries = await fs.readdir(dataDir);
  const years = parseCatalogueYears(dirEntries, "descending");
  await fs.writeFile(
    path.join(dataDir, "catalogue.json"),
    `${JSON.stringify({ years }, null, 2)}\n`,
    "utf-8",
  );
  console.log(`\nWrote catalogue.json manifest: years ${years[0]}–${years[years.length - 1]}`);
  await generateIndices("carleton");
}
