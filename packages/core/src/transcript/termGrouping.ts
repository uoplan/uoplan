import { isNonDegreeCourse, normalizeCourseCode } from "../utils/courseUtils";
import type {
  PdfPageText,
  TextItemWithPosition,
  TranscriptTerm,
  TranscriptTermSeason,
} from "./types";

const ROW_Y_TOLERANCE = 3;

/**
 * English term header, e.g. "2022 Fall Term" / "2024 Spring/Summer Term".
 * Requiring the trailing "Term" keyword avoids matching a course title that
 * merely contains a season word.
 */
const TERM_HEADER_EN_REGEX = /\b(\d{4})\s+(Fall|Winter|Spring\/Summer|Spring|Summer)\s+Term\b/i;

/**
 * French term header, best-effort, e.g. "Trimestre d'automne 2022" /
 * "Automne 2022" / "Printemps/Été 2024". Season precedes the year.
 */
const TERM_HEADER_FR_REGEX =
  /\b(Automne|Hiver|Printemps\/[ÉEée]t[ée]|Printemps|[ÉEée]t[ée])\s+(\d{4})\b/i;

/** Season-rank used to order terms chronologically within a year. */
const SEASON_RANK: Record<TranscriptTermSeason, number> = { Winter: 0, Summer: 1, Fall: 2 };

function normalizeSeason(raw: string): TranscriptTermSeason {
  const s = raw.toLowerCase();
  if (s.startsWith("winter") || s.startsWith("hiver")) return "Winter";
  if (s.startsWith("fall") || s.startsWith("automne")) return "Fall";
  // Spring, Summer, Spring/Summer, Printemps, Été, Printemps/Été → the uOttawa
  // spring/summer term.
  return "Summer";
}

interface TermHeaderMatch {
  label: string;
  year: number;
  season: TranscriptTermSeason;
}

/** Detect a term header in a row's joined text; null when the row isn't a header. */
function matchTermHeader(rowText: string): TermHeaderMatch | null {
  const en = TERM_HEADER_EN_REGEX.exec(rowText);
  if (en) {
    const year = parseInt(en[1], 10);
    const season = normalizeSeason(en[2]);
    // Normalize to "<Season> <Year>" so the collapsed spring/summer term reads
    // "Summer" (never "Spring/Summer") everywhere it's stored or displayed.
    return { label: `${season} ${year}`, year, season };
  }
  const fr = TERM_HEADER_FR_REGEX.exec(rowText);
  if (fr) {
    const year = parseInt(fr[2], 10);
    const season = normalizeSeason(fr[1]);
    return { label: `${season} ${year}`, year, season };
  }
  return null;
}

interface Row {
  y: number;
  items: TextItemWithPosition[];
}

/** Group a page's positioned items into rows (shared tolerance with course parsing). */
function groupRows(items: TextItemWithPosition[]): Row[] {
  const rows: Row[] = [];
  for (const item of items) {
    const existing = rows.find((r) => Math.abs(r.y - item.y) <= ROW_Y_TOLERANCE);
    if (existing) existing.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  // PDF user space places the origin at the bottom-left, so a larger y sits
  // higher on the page: sort descending to read top→bottom.
  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Read a normalized course code from a row's first two cells, or null. */
function rowCourseCode(row: Row): string | null {
  const category = row.items[0]?.str?.trim() ?? "";
  const number = row.items[1]?.str?.trim() ?? "";
  const combined = `${category} ${number}`.trim();
  if (!combined) return null;
  const normalized = normalizeCourseCode(combined);
  if (!/^[A-Z]{3,4}\s+\d{4,5}[A-Z]?$/i.test(normalized)) return null;
  return normalized;
}

function termSortKey(term: TranscriptTerm): number {
  return term.year * 10 + SEASON_RANK[term.season];
}

/**
 * Group a transcript's completed courses by the term they were taken in, using
 * the positioned text rows (term-header rows introduce a block; the course rows
 * beneath them belong to that term). Returns terms sorted chronologically.
 *
 * Requires positioned items (real transcript PDFs have them); pages without
 * positions contribute nothing, so a fully position-less transcript yields `[]`
 * and callers fall back to a single "completed" grouping.
 */
export function collectTranscriptTerms(pages: PdfPageText[]): TranscriptTerm[] {
  const terms: TranscriptTerm[] = [];
  let current: TranscriptTerm | null = null;
  const seenPerTerm = new Set<string>();

  for (const page of pages) {
    if (!page.hasPosition || page.itemsWithPosition.length === 0) continue;

    for (const row of groupRows(page.itemsWithPosition)) {
      const rowText = row.items
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join(" ");
      if (!rowText) continue;

      const header = matchTermHeader(rowText);
      if (header) {
        current = { label: header.label, year: header.year, season: header.season, courses: [] };
        terms.push(current);
        seenPerTerm.clear();
        continue;
      }

      if (!current) continue;
      const code = rowCourseCode(row);
      if (!code || isNonDegreeCourse(code)) continue;
      if (seenPerTerm.has(code)) continue;
      seenPerTerm.add(code);
      current.courses.push(code);
    }
  }

  return terms
    .filter((term) => term.courses.length > 0)
    .sort((a, b) => termSortKey(a) - termSortKey(b));
}
