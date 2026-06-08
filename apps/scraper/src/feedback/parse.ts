/**
 * Stage 2 — parse. Read the raw cache produced by stage 1 and emit the committed
 * per-term dataset `apps/scraper/data/feedback/feedback.<termId>.json`. Runs fully offline.
 *
 * The list titles alone yield the primary prof <-> section <-> course join key; when
 * `stats` is set and report HTML was cached, per-question summary stats are attached.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  cachedTermIds,
  chartPath,
  listIsComplete,
  optionsPath,
  outputExists,
  outputPath,
  readListMeta,
  readListPages,
  readReportHtml,
  writeJsonFile,
} from "./cache.ts";
import { parseListRows } from "./list.ts";
import { extractChartLabels, terminateOcr } from "./ocr.ts";
import { parseReport, type ReportQuestionStats } from "./report.ts";
import { ordinalOptionLabels } from "./scales.ts";
import { parseReportTitle } from "./title.ts";

type OptionLabelMap = Record<string, string[]>;

interface FeedbackSection {
  section: string;
  /** "First Last" display order (matches grades.json). */
  professor: string;
  title: string;
  /** Per-question survey stats; present once the report HTML has been fetched. */
  questions?: ReportQuestionStats[];
}

interface FeedbackCourse {
  /** Course code, normalized to grades.json format, e.g. "ITI 1120". */
  code: string;
  sections: FeedbackSection[];
}

type FeedbackFile = FeedbackCourse[];

interface ParseOptions {
  terms?: string[];
  force?: boolean;
  stats?: boolean;
}

interface ParsedTerm {
  termLabel: string;
  sectionCount: number;
  output: FeedbackFile;
  optionLabels: OptionLabelMap;
}

/**
 * Record a scale question's ordinal option labels (best-first) into `sink`,
 * keyed by question text, the first time the question is seen. Older reports
 * carry the labels in their HTML option table; modern reports omit them (the
 * distribution lives only in the `ChartPic_*.png`), so those are recovered by
 * OCRing the chart. Only the labels are kept — they are a per-question property,
 * stored once in the committed sidecar rather than duplicated per section.
 */
async function harvestOptionLabels(
  termId: string,
  reportId: string,
  questions: ReportQuestionStats[],
  sink: OptionLabelMap,
): Promise<void> {
  for (const q of questions) {
    if (sink[q.question]) continue;

    let rawLabels: string[] | null = null;
    if (q.options.length > 0) {
      rawLabels = q.options.map((o) => o.label);
    } else if (q.chartUrl) {
      const image = await chartPath(termId, reportId, path.basename(q.chartUrl));
      if (image) rawLabels = await extractChartLabels(image);
    }
    if (!rawLabels) continue;

    const labels = ordinalOptionLabels(rawLabels);
    if (labels) sink[q.question] = labels;
  }
}

async function parseTerm(termId: string): Promise<ParsedTerm | null> {
  const pages = await readListPages(termId);
  if (pages.length === 0) return null;
  const meta = await readListMeta(termId);

  const byCourse = new Map<string, FeedbackSection[]>();
  let sectionCount = 0;
  let unparsedTitles = 0;

  const optionLabels: OptionLabelMap = {};

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
          if (parsedReport.length > 0) {
            await harvestOptionLabels(termId, row.reportId, parsedReport, optionLabels);
            questions = parsedReport;
          }
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

  return { termLabel: meta?.termLabel ?? termId, sectionCount, output, optionLabels };
}

async function readOptionLabels(): Promise<OptionLabelMap> {
  try {
    return JSON.parse(await fs.readFile(optionsPath(), "utf-8")) as OptionLabelMap;
  } catch {
    return {};
  }
}

async function writeOptionLabels(labels: OptionLabelMap): Promise<void> {
  const sorted: OptionLabelMap = {};
  for (const key of Object.keys(labels).sort()) sorted[key] = labels[key];
  await writeJsonFile(optionsPath(), sorted);
}

export async function runParse(options: ParseOptions = {}): Promise<void> {
  const termIds = options.terms && options.terms.length > 0 ? options.terms : await cachedTermIds();

  if (termIds.length === 0) {
    console.warn("No cached terms to parse. Run the fetch stage first.");
    return;
  }
  console.log(`Parsing ${termIds.length} cached term(s)...`);

  // Merge newly-discovered labels into the committed sidecar so incremental
  // single-term parses accumulate rather than clobber other terms' questions.
  const optionLabels = await readOptionLabels();
  let labelsChanged = false;

  try {
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
      for (const [question, labels] of Object.entries(parsedTerm.optionLabels)) {
        if (!optionLabels[question]) {
          optionLabels[question] = labels;
          labelsChanged = true;
        }
      }
      console.log(
        `  [${termId}] ${parsedTerm.termLabel}: wrote ${String(parsedTerm.output.length)} course(s) / ` +
          `${String(parsedTerm.sectionCount)} section(s) -> data/feedback/feedback.${termId}.json`,
      );
    }
  } finally {
    await terminateOcr();
  }

  if (labelsChanged) {
    await writeOptionLabels(optionLabels);
    console.log(
      `  wrote ${String(Object.keys(optionLabels).length)} question option set(s) -> data/feedback/feedback.options.json`,
    );
  }
}
