interface CompatReadableStream {
  [Symbol.asyncIterator]: () => AsyncGenerator<Uint8Array, void, unknown>;
  getReader(): {
    read(): Promise<{ done: boolean; value: Uint8Array }>;
    releaseLock(): void;
  };
}

if (
  typeof ReadableStream !== "undefined" &&
  !(ReadableStream.prototype as unknown as CompatReadableStream)[Symbol.asyncIterator]
) {
  (ReadableStream.prototype as unknown as CompatReadableStream)[Symbol.asyncIterator] =
    async function* (this: CompatReadableStream) {
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    };
}

let workerInitialized = false;

function readWorkerUrl(moduleValue: unknown): string {
  if (
    moduleValue &&
    typeof moduleValue === "object" &&
    "default" in moduleValue &&
    typeof (moduleValue as { default: unknown }).default === "string"
  ) {
    return (moduleValue as { default: string }).default;
  }
  throw new Error("Unable to resolve pdf.js worker URL");
}

async function ensureWorker(): Promise<void> {
  if (workerInitialized) return;
  const pdfjsLib = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  const workerUrl = readWorkerUrl(workerModule);
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  workerInitialized = true;
}

import type { PdfPageText, TextItemWithPosition } from "@uoplan/core/transcript";
export type { PdfPageText } from "@uoplan/core/transcript";

interface PdfTextContentItem {
  str?: string;
  transform?: number[];
}

function itemString(item: unknown): string {
  if (item && typeof item === "object" && "str" in item) {
    const str = (item as { str?: unknown }).str;
    return typeof str === "string" ? str : "";
  }
  return "";
}

async function extractPageText(page: {
  getTextContent(): Promise<{ items: unknown[] }>;
}): Promise<PdfPageText> {
  const textContent = await page.getTextContent();
  const rawItems = textContent.items as PdfTextContentItem[];
  const itemsWithPosition: TextItemWithPosition[] = [];
  let hasPosition = false;

  for (const item of rawItems) {
    const str = item.str ?? "";
    if (!str.trim()) continue;
    const transform = item.transform;
    if (transform && transform.length >= 6) {
      hasPosition = true;
      itemsWithPosition.push({
        str,
        x: transform[4],
        y: transform[5],
      });
    } else {
      itemsWithPosition.push({ str, x: 0, y: 0 });
    }
  }

  return {
    pageText: textContent.items.map(itemString).join(" "),
    itemsWithPosition,
    hasPosition,
  };
}

export async function extractTranscriptPdfPages(arrayBuffer: ArrayBuffer): Promise<PdfPageText[]> {
  await ensureWorker();
  const pdfjsLib = await import("pdfjs-dist");
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PdfPageText[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    pages.push(await extractPageText(await pdf.getPage(pageNum)));
  }

  return pages;
}
