import type { Catalogue, Program } from "@uoplan/domain/dataTypes";
import {
  buildCalendarPath,
  CarletonCalendarClient,
  parseProgramIndex,
  parseSubjectIndex,
  programPageUrl,
  subjectCoursesUrl,
} from "./client.ts";
import type { CarletonCourseExtras } from "./parseCourses.ts";
import { parseSubjectCourses } from "./parseCourses.ts";
import { parseProgramPage } from "./parsePrograms.ts";

export type ScrapeMiss = {
  kind: "subject" | "program" | "index";
  id: string;
  url: string;
  reason: string;
};

export type ScrapeReport = {
  coursesParsed: number;
  programsParsed: number;
  totalRequirements: number;
  parsedRequirements: number;
  requirementParseRate: number;
  misses: ScrapeMiss[];
  unparsedRequirements: string[];
};

export type ScrapeCarletonCatalogueResult = {
  catalogue: Catalogue;
  courseExtras: Map<string, CarletonCourseExtras>;
  report: ScrapeReport;
};

type CarletonCalendarClientLike = {
  fetchSubjectIndex(year?: string): Promise<string>;
  fetchSubjectCourses(subject: string, year?: string): Promise<string>;
  fetchUndergradProgramsIndex?(year?: string): Promise<string>;
  fetchProgramPage(slug: string, year?: string): Promise<string>;
};

export type ScrapeCarletonCatalogueOptions = {
  year?: string;
  client?: CarletonCalendarClientLike;
  subjects?: string[];
  programSlugs?: string[];
  delayMs?: number;
  log?: boolean;
  /** Parallel CourseLeaf fetches. CourseLeaf is a static CDN-backed site. */
  concurrency?: number;
};

/**
 * CourseLeaf pages are static documents behind a CDN with no session state, so
 * subject and program pages can be fetched concurrently. A year is ~570 pages;
 * serially that is over a minute per year and 20+ archived years would take
 * well over half an hour, so the two page loops run through a small worker pool.
 */
const CARLETON_CATALOGUE_CONCURRENCY = 12;

/**
 * Run `worker` over `items` with at most `concurrency` in flight. Results are
 * written back positionally so output order is independent of completion order,
 * keeping the emitted JSON stable across runs.
 */
async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = Array.from({ length: items.length }) as R[];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getProgramIndex(client: CarletonCalendarClientLike, year?: string): Promise<string> {
  if (client.fetchUndergradProgramsIndex) return client.fetchUndergradProgramsIndex(year);
  const indexClient = new CarletonCalendarClient();
  return indexClient.fetchUndergradProgramsIndex(year);
}

export async function scrapeCarletonCatalogue(
  options: ScrapeCarletonCatalogueOptions = {},
): Promise<ScrapeCarletonCatalogueResult> {
  const year = options.year;
  const concurrency = options.concurrency ?? CARLETON_CATALOGUE_CONCURRENCY;
  const client =
    options.client ?? new CarletonCalendarClient({ delayMs: options.delayMs ?? 0, concurrency });
  const misses: ScrapeMiss[] = [];
  const courses: Catalogue["courses"] = [];
  const programs: Program[] = [];
  const courseExtras = new Map<string, CarletonCourseExtras>();
  const unparsedRequirements = new Set<string>();
  let totalRequirements = 0;
  let parsedRequirements = 0;

  let subjects = options.subjects;
  if (!subjects) {
    try {
      subjects = parseSubjectIndex(await client.fetchSubjectIndex(year));
    } catch (error: unknown) {
      misses.push({
        kind: "index",
        id: "subjects",
        url: buildCalendarPath("/undergrad/courses/", year),
        reason: getErrorMessage(error),
      });
      subjects = [];
    }
  }

  const subjectResults = await mapPool(subjects, concurrency, async (subject) => {
    try {
      return {
        subject,
        parsed: parseSubjectCourses(await client.fetchSubjectCourses(subject, year)),
      };
    } catch (error: unknown) {
      return { subject, reason: getErrorMessage(error) };
    }
  });
  for (const result of subjectResults) {
    if ("parsed" in result && result.parsed) {
      courses.push(...result.parsed.courses);
      for (const [code, extras] of result.parsed.extras) courseExtras.set(code, extras);
    } else if ("reason" in result) {
      misses.push({
        kind: "subject",
        id: result.subject,
        url: subjectCoursesUrl(result.subject, year),
        reason: result.reason as string,
      });
    }
  }

  let programSlugs = options.programSlugs;
  if (!programSlugs) {
    try {
      programSlugs = parseProgramIndex(await getProgramIndex(client, year));
    } catch (error: unknown) {
      misses.push({
        kind: "index",
        id: "programs",
        url: buildCalendarPath("/undergrad/undergradprograms/", year),
        reason: getErrorMessage(error),
      });
      programSlugs = [];
    }
  }

  const programResults = await mapPool(programSlugs, concurrency, async (slug) => {
    try {
      return {
        slug,
        parsed: parseProgramPage(
          await client.fetchProgramPage(slug, year),
          programPageUrl(slug, year),
        ),
      };
    } catch (error: unknown) {
      return { slug, reason: getErrorMessage(error) };
    }
  });
  for (const result of programResults) {
    if ("parsed" in result && result.parsed) {
      programs.push(...result.parsed.programs);
      totalRequirements += result.parsed.stats.totalRequirements;
      parsedRequirements += result.parsed.stats.parsedRequirements;
      for (const requirement of result.parsed.unparsed) unparsedRequirements.add(requirement);
    } else if ("reason" in result) {
      misses.push({
        kind: "program",
        id: result.slug,
        url: programPageUrl(result.slug, year),
        reason: result.reason as string,
      });
    }
  }

  courses.sort((a, b) => a.code.localeCompare(b.code));
  programs.sort((a, b) => (a.slug ?? a.url).localeCompare(b.slug ?? b.url));

  const requirementParseRate = totalRequirements === 0 ? 1 : parsedRequirements / totalRequirements;
  const report: ScrapeReport = {
    coursesParsed: courses.length,
    programsParsed: programs.length,
    totalRequirements,
    parsedRequirements,
    requirementParseRate,
    misses,
    unparsedRequirements: Array.from(unparsedRequirements).sort(),
  };

  if (options.log !== false) {
    console.log(
      `Carleton catalogue scrape${year ? ` ${year}` : ""}: ${courses.length} courses, ${programs.length} programs, ${Math.round(
        requirementParseRate * 100,
      )}% requirement parse rate, ${misses.length} misses`,
    );
  }

  return { catalogue: { courses, programs }, courseExtras, report };
}

// CLI/data-file wiring is intentionally left to the shared school plumbing follow-up.
