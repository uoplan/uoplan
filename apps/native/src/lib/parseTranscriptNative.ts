// Native transcript parsing facade. The PDF→pages extraction is delegated to the
// `'use dom'` WebView component (`transcript-extractor.dom.tsx`); the pure
// text-processing stage lives in `@uoplan/core/transcript`, shared byte-for-byte
// with the web flow (`@uoplan/transcript`). This module just re-exports the pure
// pieces the personalize screen consumes so it never imports pdfjs.
export {
  findBestMatchingProgram,
  processExtractedPages,
  type PdfPageText,
  type ProgramMatchResult,
  type TranscriptParseResult,
} from "@uoplan/core/transcript";
