"use dom";

// This file runs inside a WKWebView (iOS) / Chromium WebView (Android) via Expo's
// `'use dom'` directive — a full browser environment, NOT Hermes. It is bundled by
// Metro for the web target. `unpdf` ships a serverless pdfjs build (worker inlined,
// WASM stripped) so PDF text extraction works identically to the web app without a
// native rebuild. The native side passes the PDF as a base64 prop and receives the
// extracted pages back through the async `onResult` native-action callback.
import { useEffect } from "react";
import type { DOMProps } from "expo/dom";
import { getDocumentProxy } from "unpdf";

import type { PdfPageText, TextItemWithPosition } from "@uoplan/core/transcript";

interface PdfTextContentItem {
  str?: string;
  transform?: number[];
}

export interface TranscriptExtractorProps {
  /** Base64-encoded PDF bytes, or null when there is nothing to extract. */
  pdfBase64: string | null;
  /** Native action invoked with the extracted pages (mirrors the web `PdfPageText[]`). */
  onResult: (pages: PdfPageText[]) => Promise<void>;
  /** Native action invoked with a human-readable message when extraction fails. */
  onError: (message: string) => Promise<void>;
  /** Expo DOM host props (e.g. `matchContents` to silence the zero-height warning). */
  dom?: DOMProps;
}

function extractPage(items: PdfTextContentItem[]): PdfPageText {
  const itemsWithPosition: TextItemWithPosition[] = [];
  let hasPosition = false;

  for (const item of items) {
    const str = item.str ?? "";
    if (!str.trim()) continue;
    const transform = item.transform;
    if (transform && transform.length >= 6) {
      hasPosition = true;
      itemsWithPosition.push({ str, x: transform[4], y: transform[5] });
    } else {
      itemsWithPosition.push({ str, x: 0, y: 0 });
    }
  }

  return {
    pageText: items.map((item) => item.str ?? "").join(" "),
    itemsWithPosition,
    hasPosition,
  };
}

export default function TranscriptExtractor({
  pdfBase64,
  onResult,
  onError,
}: TranscriptExtractorProps) {
  useEffect(() => {
    if (!pdfBase64) return;
    let cancelled = false;

    void (async () => {
      try {
        const binary = atob(pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdf = await getDocumentProxy(bytes);
        const pages: PdfPageText[] = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          pages.push(extractPage(content.items as PdfTextContentItem[]));
        }

        if (!cancelled) await onResult(pages);
      } catch (error) {
        if (!cancelled) {
          await onError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBase64, onResult, onError]);

  // DOM components must return an element (not null); render an invisible host.
  return <div style={{ width: 0, height: 0, overflow: "hidden" }} />;
}
