import { normalizeCourseCode, isNonDegreeCourse } from "@uoplan/core";
import type { PdfPageText, TextItemWithPosition } from "./pdfExtraction";

const COURSE_CODE_REGEX = /\b([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)\b/gi;
const OPT_PLACEHOLDER_REGEX = /\bOPT\s+([1-9])XXX\b/gi;
const ROW_Y_TOLERANCE = 3;

function assignOptCode(digit: string, optCounters: Map<number, number>): string {
  const level = parseInt(digit, 10) * 1000;
  const offset = optCounters.get(level) ?? 0;
  optCounters.set(level, offset + 1);
  return `OPT ${level + offset}`;
}

function extractCodesFromPositions(
  items: TextItemWithPosition[],
  optCounters: Map<number, number>,
): string[] {
  const codes: string[] = [];
  if (items.length === 0) return codes;

  const byRow = new Map<number, TextItemWithPosition[]>();
  for (const item of items) {
    const y = item.y;
    let rowKey: number | null = null;
    for (const key of byRow.keys()) {
      if (Math.abs(key - y) <= ROW_Y_TOLERANCE) {
        rowKey = key;
        break;
      }
    }
    if (rowKey == null) rowKey = y;
    const row = byRow.get(rowKey) ?? [];
    row.push(item);
    byRow.set(rowKey, row);
  }

  for (const row of byRow.values()) {
    row.sort((a, b) => a.x - b.x);
    const category = row[0]?.str?.trim() ?? "";
    const number = row[1]?.str?.trim() ?? "";
    const combined = `${category} ${number}`.trim();
    if (!combined) continue;

    const optMatch = /^OPT\s+([1-9])XXX$/i.exec(combined);
    if (optMatch) {
      codes.push(assignOptCode(optMatch[1], optCounters));
      continue;
    }

    const normalized = normalizeCourseCode(combined);
    if (/^[A-Z]{3,4}\s+\d{4,5}[A-Z]?$/i.test(normalized)) {
      codes.push(normalized);
    }
  }
  return codes;
}

function extractOptFromText(text: string, optCounters: Map<number, number>): string[] {
  const codes: string[] = [];
  OPT_PLACEHOLDER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPT_PLACEHOLDER_REGEX.exec(text)) !== null) {
    codes.push(assignOptCode(match[1], optCounters));
  }
  return codes;
}

function extractCodesFromText(text: string): string[] {
  const codes: string[] = [];
  let match: RegExpExecArray | null;
  COURSE_CODE_REGEX.lastIndex = 0;
  while ((match = COURSE_CODE_REGEX.exec(text)) !== null) {
    codes.push(normalizeCourseCode(`${match[1]} ${match[2]}`));
  }
  return codes;
}

export function collectTranscriptCourseCodes(pages: PdfPageText[]): string[] {
  const allCodes = new Set<string>();
  const optCounters = new Map<number, number>();

  for (const page of pages) {
    if (page.hasPosition && page.itemsWithPosition.length > 0) {
      extractCodesFromPositions(page.itemsWithPosition, optCounters).forEach((code) =>
        allCodes.add(code),
      );
    } else {
      extractOptFromText(page.pageText, optCounters).forEach((code) => allCodes.add(code));
    }

    extractCodesFromText(page.pageText).forEach((code) => allCodes.add(code));
  }

  return [...allCodes].filter((code) => !isNonDegreeCourse(code));
}
