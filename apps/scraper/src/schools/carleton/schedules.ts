import fs from "node:fs/promises";
import path from "node:path";
import type { SchedulesData } from "@uoplan/domain/dataTypes";
import { catalogueDataDir, schedulesDataDir } from "../../shared/paths.ts";
import { CarletonBannerClient } from "./banner/client.ts";
import { parseCourseSearch } from "./banner/parseCourseSearch.ts";
import { parseTerms } from "./banner/parseTerms.ts";
import { toSchedulesData } from "./banner/toSchedulesData.ts";
import { CarletonCalendarClient, parseSubjectIndex } from "./calendar/client.ts";

type CarletonScheduleClient = Pick<CarletonBannerClient, "searchCourses">;

/** A Banner session: one client with its own cookie jar and matching session id. */
export type CarletonScheduleWorker = {
  client: CarletonScheduleClient;
  sessionId: string;
};

/**
 * Banner sessions are independent (cookie jar + session id per client), so the
 * subject list can be fanned out across several of them. Serially this is one
 * ~1.5 s request per subject — 114 subjects x 3 terms is over 8 minutes; with a
 * pool it finishes in about a minute. Verified to return byte-identical
 * per-subject section counts vs. a single serial client.
 */
const CARLETON_MAX_CONCURRENCY = 12;

/**
 * Banner intermittently answers a valid search with an empty result set under
 * load. An empty subject is also a legitimate answer (many subjects genuinely
 * offer nothing in Summer), so an empty response is retried once and only
 * believed if it comes back empty a second time.
 */
async function fetchSubjectSections(
  worker: CarletonScheduleWorker,
  termId: string,
  subject: string,
) {
  const search = async () =>
    parseCourseSearch(
      await worker.client.searchCourses({
        term: termId,
        sessionId: worker.sessionId,
        subject,
      }),
    );
  const first = await search();
  return first.length > 0 ? first : await search();
}

export async function scrapeCarletonScheduleTerm(options: {
  termId: string;
  sessionId: string;
  subjects: string[];
  client: CarletonScheduleClient;
  /** Extra Banner sessions to fan out across; defaults to the single `client`. */
  workers?: CarletonScheduleWorker[];
  onProgress?: (done: number, total: number) => void;
}): Promise<SchedulesData> {
  const workers = options.workers ?? [{ client: options.client, sessionId: options.sessionId }];
  const subjects = options.subjects;
  const sections = [];
  // Per-subject buckets keep the output order deterministic (and therefore the
  // emitted JSON stable) regardless of which worker finishes first.
  const bySubject = new Map<string, Awaited<ReturnType<typeof fetchSubjectSections>>>();

  let next = 0;
  let done = 0;
  await Promise.all(
    workers.map(async (worker) => {
      for (;;) {
        const index = next++;
        if (index >= subjects.length) return;
        const subject = subjects[index];
        try {
          bySubject.set(subject, await fetchSubjectSections(worker, options.termId, subject));
        } catch (error: unknown) {
          console.error(
            `Error fetching Carleton schedules for ${subject} (${options.termId}):`,
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          done += 1;
          options.onProgress?.(done, subjects.length);
        }
      }
    }),
  );

  for (const subject of subjects) sections.push(...(bySubject.get(subject) ?? []));
  return toSchedulesData(options.termId, sections);
}

async function loadSubjects(): Promise<string[]> {
  const onlySubject = process.env.ONLY_SUBJECT;
  if (onlySubject) return [onlySubject.toUpperCase()];
  const client = new CarletonCalendarClient();
  return parseSubjectIndex(await client.fetchSubjectIndex());
}

async function writeSchedule(termId: string, data: SchedulesData): Promise<void> {
  const scheduleDir = schedulesDataDir("carleton");
  await fs.mkdir(scheduleDir, { recursive: true });
  const outPath = path.join(scheduleDir, `schedules.${termId}.json`);
  await fs.writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(
    `Done. Saved Carleton schedules for ${data.totalWithSchedules} courses (out of ${data.totalCourses}) to ${path.basename(outPath)}`,
  );
}

export async function scrapeCarletonSchedules(): Promise<void> {
  const onlyTermId = process.env.ONLY_TERM_ID;
  const banner = new CarletonBannerClient({ delayMs: 0 });
  const selectTermHtml = await banner.fetchSelectTerm();
  const { terms, sessionId } = parseTerms(selectTermHtml);
  const selectedTerms = onlyTermId ? terms.filter((term) => term.termId === onlyTermId) : terms;
  if (onlyTermId && selectedTerms.length === 0)
    throw new Error(`ONLY_TERM_ID=${onlyTermId} not found in Carleton Banner`);
  const subjects = await loadSubjects();
  await fs.mkdir(catalogueDataDir("carleton"), { recursive: true });

  const concurrency = Number(process.env.CARLETON_CONCURRENCY ?? CARLETON_MAX_CONCURRENCY);
  console.log(`Initializing ${concurrency} Carleton Banner session(s)...`);
  const workers: CarletonScheduleWorker[] = await Promise.all(
    Array.from({ length: concurrency }, async (_, i) => {
      // Reuse the bootstrap client for the first slot; the rest need their own
      // session because Banner ties the search to the client's cookie jar.
      if (i === 0) return { client: banner, sessionId };
      const client = new CarletonBannerClient({ delayMs: 0 });
      return { client, sessionId: parseTerms(await client.fetchSelectTerm()).sessionId };
    }),
  );

  for (const term of selectedTerms) {
    const startedAt = Date.now();
    console.log(
      `Starting Carleton schedule scrape for ${term.name} (${term.termId}) across ${subjects.length} subject(s)...`,
    );
    const data = await scrapeCarletonScheduleTerm({
      termId: term.termId,
      sessionId,
      subjects,
      client: banner,
      workers,
      onProgress: (done, total) => {
        if (done % 20 === 0 || done === total) {
          console.log(`[${term.termId}] ${done}/${total} subjects...`);
        }
      },
    });
    console.log(`[${term.termId}] took ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    await writeSchedule(term.termId, data);
  }
}
