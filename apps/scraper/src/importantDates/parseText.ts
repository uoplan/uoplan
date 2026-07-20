// Shared text normalization + error/context helpers for the important-dates parser.

import type * as cheerio from "cheerio";
import type { ImportantDateCategory } from "@uoplan/core/dataTypes";
import type { CheerioNode, SourceLocale } from "./parseTypes.ts";

export function normalizeText(text: string): string {
  return text
    .replaceAll(/[\u00A0\u202F]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function normalizeKey(text: string): string {
  return normalizeText(text).toLowerCase().replaceAll("’", "'").replaceAll("–", "-");
}

export function extractPlainText($: cheerio.CheerioAPI, node: CheerioNode): string {
  const clone = $(node).clone();
  clone.find("br").replaceWith(" ");
  clone.find("p, div, li, ul, ol").each((_, element) => {
    $(element).append(" ");
  });
  return normalizeText(clone.text());
}

export function isHeaderArtifact(topic: string, dateText: string): boolean {
  const normalizedTopic = normalizeKey(topic);
  const normalizedDateText = normalizeKey(dateText);
  return (
    (normalizedTopic === "topic" && normalizedDateText === "dates") ||
    (normalizedTopic === "objet" && normalizedDateText === "dates")
  );
}

export function extractReviewedText(bodyText: string, locale: SourceLocale): string | undefined {
  const normalized = normalizeText(bodyText);
  const match =
    locale === "en"
      ? normalized.match(/Last reviewed:\s*([A-Za-z]+\s+\d{4})/)
      : normalized.match(/Dernière mise à jour\s*:?\s*([A-Za-zÀ-ÿ]+\s+\d{4})/);

  return match?.[1];
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function structuralDriftError(input: {
  sourceUrl: string;
  sourceId: string;
  category: ImportantDateCategory;
  message: string;
  group?: number;
  row?: number;
}): Error {
  const parts = [
    `Unexpected locale structural drift at ${input.sourceUrl}`,
    `sourceId=${input.sourceId}`,
    `category=${input.category}`,
  ];
  if (input.group !== undefined) {
    parts.push(`group=${input.group}`);
  }
  if (input.row !== undefined) {
    parts.push(`row=${input.row}`);
  }
  parts.push(input.message);
  return new Error(parts.join(" "));
}

export function formatRowContext(input: {
  sourceId: string;
  category: ImportantDateCategory;
  groupIndex: number;
  rowIndex: number;
}): string {
  return `[sourceId=${input.sourceId} category=${input.category} group=${input.groupIndex} row=${input.rowIndex}]`;
}
