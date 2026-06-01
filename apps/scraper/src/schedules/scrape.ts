import fs from "fs/promises";
import path from "path";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { getErrorMessage } from "../shared/errors.ts";
import {
  buildGradeLookups,
  enrichSchedulesPayload,
  formatGradeEnrichmentLine,
  type GradeLookups,
} from "./enrich.ts";
import type { CourseSchedule, ParsedCourseCode } from "./parse.ts";
import { parseCourseCode } from "./parse.ts";
import {
  createClient,
  fetchCourseSchedule,
  fetchSubjectSchedules,
  MAX_CONCURRENCY,
  USE_CACHE_ONLY,
  type ClientInfo,
} from "./search.ts";

export { parseSearchResultsHtml } from "./parse.ts";

type Term = { termId: string; name: string };

interface CatalogueCourse {
  code: string;
}

function getCatalogueYearForTerm(termName: string): number {
  const m = termName.match(/(\d{4})/);
  if (!m) throw new Error(`Cannot extract year from term name: ${termName}`);
  const year = parseInt(m[1], 10);
  return termName.toLowerCase().includes("fall") ? year : year - 1;
}

async function loadCatalogue(year: number): Promise<ParsedCourseCode[]> {
  const raw = await fs.readFile(path.join(SCRAPER_DATA_DIR, `catalogue.${year}.json`), "utf-8");
  const data = JSON.parse(raw) as { courses?: CatalogueCourse[] };
  if (!Array.isArray(data.courses)) {
    throw new Error("catalogue.json does not contain a courses array");
  }

  //const mat1300 = data.courses.find(c => c.code === 'MAT 1300');

  /*data.courses = data.courses.slice(0, 100);
  if (!data.courses.includes(mat1300!)) {
    data.courses.push(mat1300!);
  }*/

  const unique = new Map<string, ParsedCourseCode>();
  for (const course of data.courses) {
    if (!course || typeof course.code !== "string") continue;
    const parsed = parseCourseCode(course.code);
    if (!parsed) continue;
    const key = parsed.code;
    if (!unique.has(key)) {
      unique.set(key, parsed);
    }
  }

  return Array.from(unique.values());
}

async function tryLoadGradeLookups(): Promise<GradeLookups | null> {
  const gradesPath = path.join(SCRAPER_DATA_DIR, "grades.json");
  try {
    const raw = await fs.readFile(gradesPath, "utf-8");
    return buildGradeLookups(JSON.parse(raw) as unknown);
  } catch (err: unknown) {
    console.warn(
      `Could not load ${gradesPath} for grade enrichment (${getErrorMessage(err)}). Schedules will omit distribution.`,
    );
    return null;
  }
}

function createClientPool(clients: ClientInfo[]) {
  const available = [...clients];
  const waiters: ((c: ClientInfo) => void)[] = [];
  return {
    acquire(): Promise<ClientInfo> {
      const c = available.pop();
      if (c) return Promise.resolve(c);
      return new Promise<ClientInfo>((resolve) => waiters.push(resolve));
    },
    release(c: ClientInfo) {
      const waiter = waiters.shift();
      if (waiter) waiter(c);
      else available.push(c);
    },
  };
}

export async function main(): Promise<void> {
  const onlySubject = process.env.ONLY_SUBJECT;
  const onlyCatalog = process.env.ONLY_CATALOG;
  const onlyTermId = process.env.ONLY_TERM_ID;

  const termsRaw = await fs.readFile(path.join(SCRAPER_DATA_DIR, "terms.json"), "utf-8");
  let terms: Term[] = (JSON.parse(termsRaw) as { terms: Term[] }).terms;

  if (onlyTermId) {
    terms = terms.filter((t) => t.termId === onlyTermId);
    if (terms.length === 0) {
      throw new Error(`ONLY_TERM_ID=${onlyTermId} not found in terms.json`);
    }
  }

  console.log("Initializing PeopleSoft session...");
  const clientCount = USE_CACHE_ONLY ? 1 : MAX_CONCURRENCY;
  const clientInfos: ClientInfo[] = await Promise.all(
    Array.from({ length: clientCount }, createClient),
  );
  console.log(`Initialized ${clientInfos.length} PeopleSoft session(s).`);

  const gradeLookups = await tryLoadGradeLookups();

  for (const term of terms) {
    const catalogueYear = getCatalogueYearForTerm(term.name);
    console.log(`Loading catalogue.${catalogueYear}.json for ${term.name}...`);
    const allCourses = await loadCatalogue(catalogueYear);
    console.log(`Found ${allCourses.length} unique course codes.`);

    const courses =
      onlySubject || onlyCatalog
        ? allCourses.filter((c) => {
            if (onlySubject && c.subject !== onlySubject) return false;
            if (onlyCatalog && c.catalogNbr !== onlyCatalog) return false;
            return true;
          })
        : allCourses;

    if (courses.length !== allCourses.length) {
      console.log(
        `Filtered to ${courses.length} course(s) based on ONLY_SUBJECT/ONLY_CATALOG environment variables.`,
      );
    }

    // Group catalogue courses by subject for subject-level searching + per-course fallback.
    const coursesBySubject = new Map<string, ParsedCourseCode[]>();
    for (const course of courses) {
      const list = coursesBySubject.get(course.subject) ?? [];
      list.push(course);
      coursesBySubject.set(course.subject, list);
    }
    const subjects = Array.from(coursesBySubject.keys()).sort();

    const pool = createClientPool(USE_CACHE_ONLY ? [clientInfos[0]] : clientInfos);
    const results: CourseSchedule[] = [];
    let processed = 0;

    console.log(
      `Starting schedule scrape for ${term.name} (${term.termId}) across ${subjects.length} subject(s)...`,
    );

    const tasks = subjects.map((subject) =>
      (async () => {
        const subjectCourses = coursesBySubject.get(subject) ?? [];
        const clientInfo = await pool.acquire();
        try {
          let subjectResults: CourseSchedule[];
          if (onlyCatalog) {
            // Debugging a specific course: use the exact per-course path.
            subjectResults = [];
            for (const course of subjectCourses) {
              const schedule = await fetchCourseSchedule(clientInfo, course, term.termId);
              if (schedule) subjectResults.push(schedule);
            }
          } else {
            subjectResults = await fetchSubjectSchedules(
              clientInfo,
              term.termId,
              subject,
              subjectCourses,
            );
          }
          for (const schedule of subjectResults) results.push(schedule);
        } catch (err: unknown) {
          console.error(
            `Error fetching schedules for subject ${subject} (${term.termId}):`,
            getErrorMessage(err),
          );
        } finally {
          pool.release(clientInfo);
          processed += 1;
          console.log(
            `[${term.termId}] Processed ${processed}/${subjects.length} subjects (${results.length} courses so far)...`,
          );
        }
      })(),
    );

    await Promise.all(tasks);

    results.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const output = {
      termId: term.termId,
      totalCourses: courses.length,
      totalWithSchedules: results.length,
      schedules: results,
    };

    if (gradeLookups) {
      const enrichmentStats = { sectionsTotal: 0, matched: 0, fallback: 0, none: 0 };
      enrichSchedulesPayload(output, gradeLookups, enrichmentStats);
      console.log(formatGradeEnrichmentLine(`Grades (${term.termId})`, enrichmentStats));
    }

    const outPath = path.join(SCRAPER_DATA_DIR, `schedules.${term.termId}.json`);
    await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(
      `Done. Saved schedules for ${results.length} courses (out of ${courses.length}) to ${path.basename(outPath)}`,
    );
  }
}
