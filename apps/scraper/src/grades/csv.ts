/**
 * Stage 1 of the grades scraper: read and aggregate the raw grade-distribution
 * CSVs in `apps/scraper/data/raw`.
 *
 * Aggregation rules:
 *   - grade columns (`A+`, `A`, ...) are matched verbatim; every other header is
 *     lowercased (so `Term`/`Course`/`Section` -> `term`/`course`/`section`);
 *   - missing grade columns default to 0;
 *   - rows are grouped by `(term, course, section)` with grade buckets summed.
 *
 * `term` is kept as the raw PeopleSoft STRM (e.g. 2179) — uoplan's `grades.json`
 * uses the STRM directly as `termId`, with no season transform.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { RAW_DATA_DIR } from "../shared/paths.ts";
import {
  addDistribution,
  type Distribution,
  emptyDistribution,
  GRADE_KEYS,
  isGradeKey,
  normalizeCode,
} from "./distribution.ts";

export interface GradeRow {
  termId: number;
  code: string;
  section: string;
  distribution: Distribution;
}

/**
 * Parse CSV text into rows of string cells. Throws on malformed input
 * (unterminated quotes, inconsistent column counts) so corrupt files fail loudly
 * rather than silently producing partial data.
 */
function parseCsv(text: string): string[][] {
  return parse(text, {
    bom: true,
    skipEmptyLines: true,
    relaxColumnCount: false,
    trim: false,
  }) as string[][];
}

/** Lowercase non-grade headers; keep grade-bucket headers verbatim. */
function normalizeHeader(header: string): string {
  const trimmed = header.trim();
  return isGradeKey(trimmed) ? trimmed : trimmed.toLowerCase();
}

function toCount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseGradeFile(text: string, fileLabel: string): GradeRow[] {
  let records: string[][];
  try {
    records = parseCsv(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${fileLabel}: failed to parse CSV — ${message}`);
  }
  if (records.length === 0) return [];

  const header = records[0].map(normalizeHeader);
  const idx = (name: string) => header.indexOf(name);
  const termIdx = idx("term");
  const courseIdx = idx("course");
  const sectionIdx = idx("section");

  if (termIdx === -1 || courseIdx === -1 || sectionIdx === -1) {
    throw new Error(
      `${fileLabel}: CSV is missing required column(s) term/course/section (found: ${header.join(", ")})`,
    );
  }

  const gradeColumns = GRADE_KEYS.map((key) => [key, idx(key)] as const).filter(
    ([, i]) => i !== -1,
  );

  const rows: GradeRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    const termRaw = record[termIdx]?.trim();
    const code = normalizeCode(record[courseIdx] ?? "");
    const section = (record[sectionIdx] ?? "").trim();
    const termId = Number(termRaw);
    if (!termRaw || !Number.isFinite(termId) || !code || !section) continue;

    const distribution = emptyDistribution();
    for (const [key, i] of gradeColumns) distribution[key] = toCount(record[i]);
    rows.push({ termId, code, section, distribution });
  }
  return rows;
}

/** Aggregate raw rows by `(termId, code, section)`, summing grade buckets. */
function aggregate(rows: GradeRow[]): GradeRow[] {
  const merged = new Map<string, GradeRow>();
  for (const row of rows) {
    const key = `${row.termId}|${row.code}|${row.section}`;
    const existing = merged.get(key);
    if (existing) {
      addDistribution(existing.distribution, row.distribution);
    } else {
      merged.set(key, { ...row, distribution: { ...row.distribution } });
    }
  }
  return [...merged.values()];
}

/** Read, parse and aggregate every `*.csv` under `apps/scraper/data/raw`. */
export async function readGradeRows(dir: string = RAW_DATA_DIR): Promise<GradeRow[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    throw new Error(
      `Raw grade directory not found: ${dir}. Add the grade CSVs there before running the grades scraper.`,
    );
  }

  const csvFiles = entries.filter((f) => f.toLowerCase().endsWith(".csv")).sort();
  if (csvFiles.length === 0) {
    throw new Error(
      `No CSV files found in ${dir}. Add grade CSVs (term, course, section, grade columns) there first.`,
    );
  }

  const all: GradeRow[] = [];
  for (const file of csvFiles) {
    const text = await fs.readFile(path.join(dir, file), "utf-8");
    all.push(...parseGradeFile(text, file));
  }
  return aggregate(all);
}
