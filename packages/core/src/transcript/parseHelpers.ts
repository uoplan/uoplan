import { collectTranscriptCourseCodes } from "./courseCodeMatching";
import { collectTranscriptTerms } from "./termGrouping";
import type { PdfPageText, TranscriptTerm } from "./types";

export interface TranscriptParseResult {
  courses: string[];
  /** Completed courses grouped by the term they were taken in (chronological). */
  terms: TranscriptTerm[];
  fullText: string;
  startingYear: number | null;
  /** True when transcript text suggests the French Immersion Stream (lenient match). */
  frenchImmersionStreamHint: boolean;
}

/** Lenient detection for transcript PDFs (EN/FR layout variants). */
export function detectFrenchImmersionStreamHint(fullText: string): boolean {
  const t = fullText.toLowerCase().replaceAll(/\s+/g, " ");
  if (/french\s+immersion/.test(t)) return true;
  if (/immersion\s+fran[cç]aise/.test(t)) return true;
  if (/immersion\s+stream/.test(t)) return true;
  return false;
}

export function parseStartingYear(fullText: string): number | null {
  const lines = fullText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = /start\s+of\s+transcript\s+(\d{4})\s+(Fall|Winter|Summer|Spring)/i.exec(lines[i]);
    if (!match) continue;
    const year = parseInt(match[1], 10);
    const term = match[2].toLowerCase();
    return term === "fall" ? year : year - 1;
  }
  return null;
}

/**
 * Pure text-processing stage shared by the web (pdfjs) and native (`'use dom'`
 * WebView) transcript flows: given already-extracted PDF pages, derive the
 * normalized course list, joined full text, starting year, and the French
 * Immersion stream hint. The PDF→pages extraction is platform-specific and lives
 * outside core (`@uoplan/transcript` on web, the DOM component on native).
 */
export function processExtractedPages(pages: PdfPageText[]): TranscriptParseResult {
  const fullText = pages.map((page) => page.pageText).join("\n");

  return {
    courses: collectTranscriptCourseCodes(pages),
    terms: collectTranscriptTerms(pages),
    fullText,
    startingYear: parseStartingYear(fullText),
    frenchImmersionStreamHint: detectFrenchImmersionStreamHint(fullText),
  };
}
