import { collectTranscriptCourseCodes } from "./courseCodeMatching";
import { extractTranscriptPdfPages } from "./pdfExtraction";
export { findBestMatchingProgram } from "./programMatching";
export type { ProgramMatchResult } from "./programMatching";

export interface TranscriptParseResult {
  courses: string[];
  fullText: string;
  startingYear: number | null;
  /** True when transcript text suggests the French Immersion Stream (lenient match). */
  frenchImmersionStreamHint: boolean;
}

/** Lenient detection for transcript PDFs (EN/FR layout variants). */
export function detectFrenchImmersionStreamHint(fullText: string): boolean {
  const t = fullText.toLowerCase().replace(/\s+/g, " ");
  if (/french\s+immersion/.test(t)) return true;
  if (/immersion\s+fran[cç]aise/.test(t)) return true;
  if (/immersion\s+stream/.test(t)) return true;
  return false;
}

function parseStartingYear(fullText: string): number | null {
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

export async function parseTranscriptPdf(arrayBuffer: ArrayBuffer): Promise<TranscriptParseResult> {
  const pages = await extractTranscriptPdfPages(arrayBuffer);
  const fullText = pages.map((page) => page.pageText).join("\n");

  return {
    courses: collectTranscriptCourseCodes(pages),
    fullText,
    startingYear: parseStartingYear(fullText),
    frenchImmersionStreamHint: detectFrenchImmersionStreamHint(fullText),
  };
}
