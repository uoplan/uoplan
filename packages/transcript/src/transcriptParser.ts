import {
  detectFrenchImmersionStreamHint,
  processExtractedPages,
  type TranscriptParseResult,
} from "@uoplan/core/transcript";
import { extractTranscriptPdfPages } from "./pdfExtraction";

export { findBestMatchingProgram } from "@uoplan/core/transcript";
export type { ProgramMatchResult, TranscriptParseResult } from "@uoplan/core/transcript";
export { detectFrenchImmersionStreamHint };

export async function parseTranscriptPdf(arrayBuffer: ArrayBuffer): Promise<TranscriptParseResult> {
  const pages = await extractTranscriptPdfPages(arrayBuffer);
  return processExtractedPages(pages);
}
