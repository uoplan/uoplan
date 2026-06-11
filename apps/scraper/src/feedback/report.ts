/**
 * Parse an individual course-evaluation report into its per-question summary
 * statistics. Each `.report-block` carries a question title, a statistics table
 * (Registered Students / Number of responses / Average / Standard Deviation) and,
 * depending on the portal era, the Likert distribution either as an HTML frequency
 * table (older reports — captured here as `options`) or only inside a `ChartPic_*.png`
 * bar chart (modern reports — we capture the chart URL; the numbers need OCR).
 */

import * as cheerio from "cheerio";
import { normalizeWhitespace } from "../shared/text.ts";

export interface ReportOption {
  /** Response label, e.g. "almost always". */
  label: string;
  /** Number of responses for this option. */
  count: number | null;
  /** Percentage of responses for this option (0-100), parsed from "50%". */
  percentage: number | null;
}

export interface ReportQuestionStats {
  question: string;
  /** Chart image URL (relative to the report origin), if present. */
  chartUrl: string | null;
  registeredStudents: number | null;
  responses: number | null;
  average: number | null;
  standardDeviation: number | null;
  /** Per-option Likert distribution; empty when only the chart carries it. */
  options: ReportOption[];
}

interface ParsedReport {
  questions: ReportQuestionStats[];
}

const STAT_IDS: Record<string, keyof ReportQuestionStats> = {
  Invited: "registeredStudents",
  Total: "responses",
  Mean: "average",
  "Standard-Deviation": "standardDeviation",
};

/** Strip the leading "N) " enumeration from a question title. */
function stripQuestionNumber(text: string): string {
  return text.replace(/^\d+\)\s*/, "");
}

/** Strip the leading answer letter ("A: ", "B: ", ...) from an option label. */
function stripOptionLetter(text: string): string {
  return text.replace(/^[A-Z]:\s*/, "");
}

function toNumber(text: string): number | null {
  const cleaned = normalizeWhitespace(text).replaceAll(/[,%]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned.toUpperCase() === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseReport(html: string): ParsedReport {
  const $ = cheerio.load(html);
  const questions: ReportQuestionStats[] = [];

  $(".report-block").each((_, block) => {
    const $block = $(block);
    const question = stripQuestionNumber(
      normalizeWhitespace($block.find(".ReportBlockTitle").first().text()),
    );
    if (!question) return;

    // Frequency rows are scoped by `headers="scale_N"`: the row label lives in a `th`
    // and the count/percentage cells tag themselves via `FreqCount`/`FreqPercentage`.
    // Older reports carry this table; modern ones bake the distribution into the chart.
    const options: ReportOption[] = [];
    $block.find('th.TabularBody_LeftColumn[id^="scale_"]').each((__, th) => {
      const $row = $(th).closest("tr");
      options.push({
        label: stripOptionLetter(normalizeWhitespace($(th).text())),
        count: toNumber($row.find('td[headers~="FreqCount"]').first().text()),
        percentage: toNumber($row.find('td[headers~="FreqPercentage"]').first().text()),
      });
    });

    const chartSrc = $block.find(".FrequencyBlock_chart img").first().attr("src");
    const stats: ReportQuestionStats = {
      question,
      chartUrl: chartSrc ? normalizeWhitespace(chartSrc) : null,
      registeredStudents: null,
      responses: null,
      average: null,
      standardDeviation: null,
      options,
    };

    // The statistics table tags its label cells with the ids in STAT_IDS; the
    // frequency table's `scale_N` th cells fall through (not in STAT_IDS).
    $block.find("th.TabularBody_LeftColumn").each((__, th) => {
      const id = $(th).attr("id");
      const key = id ? STAT_IDS[id] : undefined;
      if (!key) return;
      const value = $(th).next("td").text();
      (stats[key] as number | null) = toNumber(value);
    });

    questions.push(stats);
  });

  return { questions };
}
