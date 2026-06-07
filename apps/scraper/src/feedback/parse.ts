/**
 * Stage 2 — parse. Read the raw cache produced by stage 1 and emit the committed
 * per-term dataset `apps/scraper/data/feedback.<termId>.json`. Runs fully offline.
 *
 * The list titles alone yield the primary prof <-> section <-> course join key; when
 * `stats` is set and report HTML was cached, per-question summary stats are attached.
 */

import {
  cachedTermIds,
  listIsComplete,
  outputExists,
  outputPath,
  readListMeta,
  readListPages,
  readReportHtml,
  writeJsonFile,
} from "./cache.ts";
import { parseListRows } from "./list.ts";
import { parseReport, type ReportQuestionStats } from "./report.ts";
import { parseReportTitle } from "./title.ts";

export interface FeedbackSection {
  /** Section code, e.g. "A00", "S100", "0". */
  section: string;
  /** "First Last" display order (matches grades.json). */
  professor: string;
  /** Course title as it appeared on the report (language-specific). */
  title: string;
  /** Per-question survey stats; present once the report HTML has been fetched. */
  questions?: ReportQuestionStats[];
}

/** One course code and every section/report evaluated under it that term. */
export interface FeedbackCourse {
  /** Course code, normalized to grades.json format, e.g. "ITI 1120". */
  code: string;
  /** Cross-listed reports contribute a section entry under each of their codes. */
  sections: FeedbackSection[];
}

export type FeedbackFile = FeedbackCourse[];

export interface ParseOptions {
  terms?: string[];
  force?: boolean;
  stats?: boolean;
}

interface ParsedTerm {
  termLabel: string;
  sectionCount: number;
  output: FeedbackFile;
}

async function parseTerm(termId: string): Promise<ParsedTerm | null> {
  const pages = await readListPages(termId);
  if (pages.length === 0) return null;
  const meta = await readListMeta(termId);

  const byCourse = new Map<string, FeedbackSection[]>();
  let sectionCount = 0;
  let unparsedTitles = 0;

  for (const html of pages) {
    for (const row of parseListRows(html)) {
      const parsed = parseReportTitle(row.title);
      if (!parsed) {
        unparsedTitles += 1;
        continue;
      }

      // Survey stats live on the individual report page; embed them when that HTML
      // has been cached (the `fetch --stats` pass), otherwise leave `questions` off.
      let questions: ReportQuestionStats[] | undefined;
      if (row.reportId) {
        const reportHtml = await readReportHtml(termId, row.reportId);
        if (reportHtml) {
          const parsedReport = parseReport(reportHtml).questions;
          if (parsedReport.length > 0) questions = parsedReport;
        }
      }

      for (const course of parsed.courses) {
        const section: FeedbackSection = {
          section: course.section,
          professor: parsed.professor,
          title: course.title,
        };
        if (questions) section.questions = questions;

        const list = byCourse.get(course.code);
        if (list) list.push(section);
        else byCourse.set(course.code, [section]);
        sectionCount += 1;
      }
    }
  }

  if (unparsedTitles > 0) {
    console.warn(`  [${termId}] ${unparsedTitles} row title(s) could not be parsed.`);
  }

  const output: FeedbackFile = [...byCourse.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, sections]) => {
      sections.sort(
        (a, b) => a.section.localeCompare(b.section) || a.professor.localeCompare(b.professor),
      );
      return { code, sections };
    });

  return { termLabel: meta?.termLabel ?? termId, sectionCount, output };
}

export async function runParse(options: ParseOptions = {}): Promise<void> {
  const termIds = options.terms && options.terms.length > 0 ? options.terms : await cachedTermIds();

  if (termIds.length === 0) {
    console.warn("No cached terms to parse. Run the fetch stage first.");
    return;
  }
  console.log(`Parsing ${termIds.length} cached term(s)...`);

  for (const termId of termIds) {
    if (!options.force && (await outputExists(termId))) {
      console.log(`  [${termId}] feedback.${termId}.json already exists, skipping.`);
      continue;
    }
    // Never emit a dataset from a partially-fetched term: its list cache is missing
    // pages, so the output would silently drop reports. Only the fetch stage marks a
    // term complete once its row count matches the portal's reported total.
    if (!options.force && !(await listIsComplete(termId))) {
      console.warn(`  [${termId}] list cache is incomplete; skipping (re-run fetch).`);
      continue;
    }
    const parsedTerm = await parseTerm(termId);
    if (!parsedTerm) {
      console.warn(`  [${termId}] no cached list pages found, skipping.`);
      continue;
    }
    await writeJsonFile(outputPath(termId), parsedTerm.output);
    console.log(
      `  [${termId}] ${parsedTerm.termLabel}: wrote ${String(parsedTerm.output.length)} course(s) / ` +
        `${String(parsedTerm.sectionCount)} section(s) -> data/feedback.${termId}.json`,
    );
  }
}
