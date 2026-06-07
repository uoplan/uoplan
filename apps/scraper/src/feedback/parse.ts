/**
 * Stage 2 — parse. Read the raw cache produced by stage 1 and emit the committed
 * per-term dataset `apps/scraper/data/feedback.<termId>.json`. Runs fully offline.
 *
 * The list titles alone yield the primary prof <-> section <-> course join key; when
 * `stats` is set and report HTML was cached, per-question summary stats are attached.
 */

import {
  cachedTermIds,
  outputExists,
  outputPath,
  readListMeta,
  readListPages,
  readReportHtml,
  writeJsonFile,
} from "./cache.ts";
import { parseListRows } from "./list.ts";
import { parseReport, type ReportQuestionStats } from "./report.ts";
import { type ParsedCourse, parseReportTitle } from "./title.ts";

export interface FeedbackReport {
  reportId: string | null;
  professor: string;
  courses: ParsedCourse[];
  questions?: ReportQuestionStats[];
}

export interface FeedbackFile {
  termId: string;
  termLabel: string;
  totalReports: number;
  generatedAt: string;
  reports: FeedbackReport[];
}

export interface ParseOptions {
  terms?: string[];
  force?: boolean;
  stats?: boolean;
}

async function parseTerm(termId: string, stats: boolean): Promise<FeedbackFile | null> {
  const pages = await readListPages(termId);
  if (pages.length === 0) return null;
  const meta = await readListMeta(termId);

  const reports: FeedbackReport[] = [];
  let unparsedTitles = 0;

  for (const html of pages) {
    for (const row of parseListRows(html)) {
      const parsed = parseReportTitle(row.title);
      if (!parsed) {
        unparsedTitles += 1;
        continue;
      }

      const report: FeedbackReport = {
        reportId: row.reportId,
        professor: parsed.professor,
        courses: parsed.courses,
      };

      if (stats && row.reportId) {
        const reportHtml = await readReportHtml(termId, row.reportId);
        if (reportHtml) report.questions = parseReport(reportHtml).questions;
      }

      reports.push(report);
    }
  }

  if (unparsedTitles > 0) {
    console.warn(`  [${termId}] ${unparsedTitles} row title(s) could not be parsed.`);
  }

  return {
    termId,
    termLabel: meta?.termLabel ?? termId,
    totalReports: meta?.totalReports ?? reports.length,
    generatedAt: new Date().toISOString(),
    reports,
  };
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
    const file = await parseTerm(termId, options.stats ?? false);
    if (!file) {
      console.warn(`  [${termId}] no cached list pages found, skipping.`);
      continue;
    }
    await writeJsonFile(outputPath(termId), file);
    console.log(
      `  [${termId}] ${file.termLabel}: wrote ${file.reports.length} report(s) -> ` +
        `data/feedback.${termId}.json`,
    );
  }
}
