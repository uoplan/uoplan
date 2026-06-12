/**
 * Convert the registrar Excel grade exports into the per-term CSV format the
 * grades scraper already consumes (`raw/grades.<STRM>.csv`).
 *
 * The Excel exports come in several layouts (header on row 1 or row 3; the term
 * column is `STRM` or `TERM`; the course column is `COURSE` or `course`; grade
 * columns appear in varying order; extra `FACULTY`/`DESCR`/`Grand Total`/`DR`
 * columns), so we locate the header row dynamically (the row containing
 * `CLASS_SECTION`) and map columns by name. Grade buckets are matched verbatim
 * against `GRADE_KEYS` (which includes `DR`); every other column is ignored.
 *
 * Rows are keyed by `(termId, code, section)` and summed (a single term can span
 * multiple per-career export files). Output uses the per-term CSV header:
 * `term,course,section,<GRADE_KEYS…>` so `csv.ts` reads it unchanged.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  addDistribution,
  emptyDistribution,
  GRADE_KEYS,
  isGradeKey,
  normalizeCode,
} from "./distribution.ts";
import type { Distribution, GradeKey } from "./distribution.ts";
import { listXlsxFiles, readXlsxRows } from "./xlsx.ts";

export interface GradeRecord {
  /** Raw PeopleSoft STRM exactly as it appears in the sheet (e.g. "2259"). */
  termId: string;
  /** Normalized course code (e.g. "ADM 1100"). */
  code: string;
  section: string;
  distribution: Distribution;
}

const SECTION_HEADER = "CLASS_SECTION";
const HEADER_SCAN_LIMIT = 10;

/** Locate the header row: the first row (within the scan limit) with CLASS_SECTION. */
function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    if (rows[i].some((cell) => cell.trim().toUpperCase() === SECTION_HEADER)) return i;
  }
  return -1;
}

function toCount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Parse one worksheet grid into grade records (pure; no I/O). */
export function parseSheetRows(rows: string[][], fileLabel: string): GradeRecord[] {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) {
    throw new Error(
      `${fileLabel}: no header row containing ${SECTION_HEADER} (within first ${HEADER_SCAN_LIMIT} rows)`,
    );
  }

  const header = rows[headerIdx].map((cell) => cell.trim());
  const lower = header.map((h) => h.toLowerCase());
  const find = (...names: string[]): number => {
    for (const name of names) {
      const i = lower.indexOf(name.toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };

  // Exact (case-insensitive) match on "course" so COURSE_CAREER / FACULTY_COURSE
  // (which contain the substring "course") are not mistaken for the course column.
  const termIdx = find("strm", "term");
  const courseIdx = find("course");
  const sectionIdx = find(SECTION_HEADER);

  if (termIdx === -1 || courseIdx === -1 || sectionIdx === -1) {
    throw new Error(
      `${fileLabel}: missing required column(s) STRM/TERM, COURSE, CLASS_SECTION (found: ${header.join(", ")})`,
    );
  }

  const gradeColumns: Array<[GradeKey, number]> = [];
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (isGradeKey(h)) gradeColumns.push([h, i]);
  }

  const records: GradeRecord[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const termId = (row[termIdx] ?? "").trim();
    const code = normalizeCode(row[courseIdx] ?? "");
    const section = (row[sectionIdx] ?? "").trim();
    if (!termId || !Number.isFinite(Number(termId)) || !code || !section) continue;

    const distribution = emptyDistribution();
    for (const [key, i] of gradeColumns) distribution[key] = toCount(row[i]);
    records.push({ termId, code, section, distribution });
  }
  return records;
}

/** Group records by termId, summing duplicate `(code, section)` distributions. */
export function groupByTerm(records: Iterable<GradeRecord>): Map<string, GradeRecord[]> {
  const byTerm = new Map<string, Map<string, GradeRecord>>();
  for (const rec of records) {
    let term = byTerm.get(rec.termId);
    if (!term) {
      term = new Map();
      byTerm.set(rec.termId, term);
    }
    const key = `${rec.code}|${rec.section}`;
    const existing = term.get(key);
    if (existing) {
      addDistribution(existing.distribution, rec.distribution);
    } else {
      term.set(key, { ...rec, distribution: { ...rec.distribution } });
    }
  }

  const out = new Map<string, GradeRecord[]>();
  for (const [termId, sections] of byTerm) {
    const list = [...sections.values()].sort(
      (a, b) => a.code.localeCompare(b.code) || a.section.localeCompare(b.section),
    );
    out.set(termId, list);
  }
  return out;
}

/** Serialize a term's records to the per-term CSV format (header + sorted rows). */
export function recordsToCsv(records: GradeRecord[]): string {
  const header = ["term", "course", "section", ...GRADE_KEYS].join(",");
  const lines = records.map((rec) =>
    [rec.termId, rec.code, rec.section, ...GRADE_KEYS.map((k) => rec.distribution[k])].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

export interface ConvertStats {
  files: number;
  terms: number;
  rows: number;
}

/**
 * Read every `*.xlsx` in `xlsxDir` and write one `grades.<STRM>.csv` per term to
 * `outDir`. Returns counts for logging.
 */
export async function convertXlsxToCsv(xlsxDir: string, outDir: string): Promise<ConvertStats> {
  const files = await listXlsxFiles(xlsxDir);
  if (files.length === 0) {
    throw new Error(
      `No .xlsx files found in ${xlsxDir}. Add the registrar Excel exports there first.`,
    );
  }

  const all: GradeRecord[] = [];
  for (const file of files) {
    const rows = await readXlsxRows(path.join(xlsxDir, file));
    all.push(...parseSheetRows(rows, file));
  }

  const byTerm = groupByTerm(all);
  await fs.mkdir(outDir, { recursive: true });

  let rowCount = 0;
  for (const [termId, records] of [...byTerm.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    await fs.writeFile(path.join(outDir, `grades.${termId}.csv`), recordsToCsv(records), "utf-8");
    rowCount += records.length;
  }

  return { files: files.length, terms: byTerm.size, rows: rowCount };
}
