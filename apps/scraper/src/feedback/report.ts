/**
 * Parse an individual (modern-era) course-evaluation report into its per-question
 * summary statistics. Each `.report-block` carries a question title, a stats table
 * (Registered Students / Number of responses / Average / Standard Deviation) and a
 * `ChartPic_*.png` bar chart. The per-option Likert distribution is only baked into
 * the chart PNG (no data labels in the HTML), so we capture the chart URL but the
 * numeric stats come from the table.
 */

import * as cheerio from "cheerio";
import { normalizeWhitespace } from "../shared/text.ts";

export interface ReportQuestionStats {
  question: string;
  /** Chart image URL (relative to the report origin), if present. */
  chartUrl: string | null;
  registeredStudents: number | null;
  responses: number | null;
  average: number | null;
  standardDeviation: number | null;
}

export interface ParsedReport {
  questions: ReportQuestionStats[];
}

const STAT_IDS: Record<string, keyof ReportQuestionStats> = {
  Invited: "registeredStudents",
  Total: "responses",
  Mean: "average",
  "Standard-Deviation": "standardDeviation",
};

function toNumber(text: string): number | null {
  const cleaned = normalizeWhitespace(text).replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned.toUpperCase() === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseReport(html: string): ParsedReport {
  const $ = cheerio.load(html);
  const questions: ReportQuestionStats[] = [];

  $(".report-block").each((_, block) => {
    const $block = $(block);
    const question = normalizeWhitespace($block.find(".ReportBlockTitle").first().text());
    if (!question) return;

    const chartSrc = $block.find(".FrequencyBlock_chart img").first().attr("src");
    const stats: ReportQuestionStats = {
      question,
      chartUrl: chartSrc ? normalizeWhitespace(chartSrc) : null,
      registeredStudents: null,
      responses: null,
      average: null,
      standardDeviation: null,
    };

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
