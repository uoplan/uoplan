import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { getErrorMessage, NotFoundError } from "../shared/errors.ts";
import { generateIndices, parseMissingByYear } from "./indices.ts";
import {
  buildBaseUrl,
  getCurrentAcademicYear,
  isArchiveBaseUrl,
  ROOT_URL,
  scrapeDisciplineLinks,
  scrapeProgramLinks,
} from "./links.ts";
import { scrapeCourses } from "./courses.ts";
import { scrapeProgram } from "./programs.ts";
import { processRequirements } from "./requirements.ts";
import { CatalogueSchema, type Catalogue, type Course, type Program } from "./schema.ts";

const OLDEST_YEAR = 2017;
const CATALOGUE_JSON_RE = /^catalogue\.(\d{4})\.json$/;

export async function scrapeYearCatalogue(
  baseUrl: string,
): Promise<{ catalogue: Catalogue; missingUrls: string[] } | null> {
  let disciplineLinks: string[];
  let programLinks: string[];
  try {
    disciplineLinks = await scrapeDisciplineLinks(baseUrl);
    programLinks = await scrapeProgramLinks(baseUrl);
  } catch (e: unknown) {
    // Entire archive year may not be published yet (404 root / courses / programs).
    if (e instanceof NotFoundError && isArchiveBaseUrl(baseUrl)) {
      console.warn(`Skipping unavailable archive (${e.message})`);
      return null;
    }
    throw e;
  }

  const limit = pLimit(10);
  const missingUrls: string[] = [];

  const allCourses: Course[] = [];
  const coursePromises = disciplineLinks.map((link) =>
    limit(async () => {
      // hrefs are root-relative paths, so always use ROOT_URL as the domain
      const url = `${ROOT_URL}${link}`;
      try {
        const courses = await scrapeCourses(url);
        allCourses.push(...courses);
      } catch (e: unknown) {
        if (e instanceof NotFoundError) {
          console.warn(`Skipping missing course page: ${url}`);
          missingUrls.push(url);
        } else {
          console.error(`Error scraping courses at ${url}: ${getErrorMessage(e)}`);
          throw e;
        }
      }
    }),
  );

  const allPrograms: Program[] = [];
  const programPromises = programLinks.map((link) =>
    limit(async () => {
      const url = `${ROOT_URL}${link}`;
      try {
        const prog = await scrapeProgram(url);
        allPrograms.push(prog);
      } catch (e: unknown) {
        if (e instanceof NotFoundError) {
          console.warn(`Skipping missing program: ${url}`);
          missingUrls.push(url);
        } else {
          console.error(`Error scraping program at ${url}: ${getErrorMessage(e)}`);
          throw e;
        }
      }
    }),
  );

  await Promise.all([...coursePromises, ...programPromises]);

  allCourses.sort((a, b) => a.code.localeCompare(b.code));
  allPrograms.sort((a, b) => a.url.localeCompare(b.url));

  const catalogue = CatalogueSchema.parse({
    courses: allCourses,
    programs: allPrograms.map((p) => ({
      ...p,
      requirements: processRequirements(p.requirements),
    })),
  });

  return { catalogue, missingUrls };
}

/** Returns the missing URLs scraped, or null if the archive year returned 404. */
export async function scrapeYear(
  year: number,
  dataDir: string,
  force: boolean,
  outYear?: number,
): Promise<string[] | null> {
  const effectiveOutYear = outYear ?? year;
  const outPath = path.join(dataDir, `catalogue.${effectiveOutYear}.json`);

  if (!force) {
    try {
      await fs.access(outPath);
      console.log(`Skipping catalogue.${effectiveOutYear}.json (already exists)`);
      return [];
    } catch {
      // file doesn't exist, proceed with scraping
    }
  }

  const baseUrl = buildBaseUrl(year);
  console.log(`\nScraping ${year}-${year + 1} from ${baseUrl}...`);

  const result = await scrapeYearCatalogue(baseUrl);
  if (result === null) {
    console.warn(`Archive unavailable at ${baseUrl}`);
    return null;
  }
  const { catalogue, missingUrls } = result;

  await fs.writeFile(outPath, JSON.stringify(catalogue, null, 2), "utf-8");
  console.log(
    `Saved catalogue.${effectiveOutYear}.json (${catalogue.courses.length} courses, ${catalogue.programs.length} programs)` +
      (missingUrls.length ? ` — ${missingUrls.length} missing (404)` : ""),
  );

  return missingUrls;
}

export async function main() {
  const dataDir = SCRAPER_DATA_DIR;
  const force = process.argv.includes("--force");
  const academicYear = getCurrentAcademicYear();
  const calendarYear = new Date().getFullYear();
  await fs.mkdir(dataDir, { recursive: true });

  // Load existing missing-URLs log so we can merge into it
  const missingPath = path.join(dataDir, "catalogue.missing.json");
  let missingByYear: Record<string, string[]> = {};
  try {
    const raw = await fs.readFile(missingPath, "utf-8");
    missingByYear = parseMissingByYear(JSON.parse(raw) as unknown);
  } catch {
    // No existing file — start fresh
  }

  // Probe archive years from OLDEST_YEAR upward, stopping at the first 404.
  // Archive HTML is immutable, so we skip years already on disk unless --force
  // is passed (e.g. to re-apply an improved parser to every year).
  for (let year = OLDEST_YEAR; year < academicYear; year++) {
    const missing = await scrapeYear(year, dataDir, force);
    if (missing === null) {
      console.warn(`Stopping archive scrape at ${year} (404)`);
      break;
    }
    if (missing.length) missingByYear[String(year)] = missing.sort();
  }

  // Always re-scrape the live (non-archived) site for the current academic year.
  // Write it under the academic year filename (e.g. catalogue.2025.json).
  const liveMissing = await scrapeYear(academicYear, dataDir, true);
  if (liveMissing !== null && liveMissing.length) {
    missingByYear[String(academicYear)] = liveMissing.sort();
  } else {
    delete missingByYear[String(academicYear)];
  }

  // Ensure the current calendar year always has a file.
  // Before September: academicYear = calendarYear - 1, so we copy the live data forward.
  // From September on: academicYear === calendarYear, nothing extra needed.
  if (calendarYear !== academicYear) {
    const srcPath = path.join(dataDir, `catalogue.${academicYear}.json`);
    const dstPath = path.join(dataDir, `catalogue.${calendarYear}.json`);
    await fs.copyFile(srcPath, dstPath);
    console.log(`\nCopied catalogue.${academicYear}.json → catalogue.${calendarYear}.json`);
    // Mirror missing URLs to the calendar year key as well
    if (missingByYear[String(academicYear)]?.length) {
      missingByYear[String(calendarYear)] = missingByYear[String(academicYear)];
    } else {
      delete missingByYear[String(calendarYear)];
    }
  }

  // Write the missing-URLs log
  await fs.writeFile(missingPath, JSON.stringify(missingByYear, null, 2), "utf-8");
  const totalMissing = Object.values(missingByYear).reduce((n, urls) => n + urls.length, 0);
  if (totalMissing > 0) {
    console.log(
      `\nWrote catalogue.missing.json (${totalMissing} missing URLs across ${Object.keys(missingByYear).length} year(s))`,
    );
  }

  // Build the manifest from files actually present in the data dir
  const dirEntries = await fs.readdir(dataDir);
  const years = dirEntries
    .map((name) => {
      const m = CATALOGUE_JSON_RE.exec(name);
      return m ? Number(m[1]) : null;
    })
    .filter((y): y is number => y !== null)
    .sort((a, b) => b - a);

  await fs.writeFile(
    path.join(dataDir, "catalogue.json"),
    JSON.stringify({ years }, null, 2),
    "utf-8",
  );
  console.log(`\nWrote catalogue.json manifest: years ${years[0]}–${years[years.length - 1]}`);

  await generateIndices(dataDir);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("\nScrape failed!");
    console.error(e);
    process.exit(1);
  });
}
