/**
 * Filesystem layout + skip logic for the two-stage feedback scraper.
 *
 * Stage 1 (fetch) writes raw artifacts under a gitignored cache so a later parse
 * (or a re-run after an error) never needs to re-download:
 *
 *   .cache/feedback/raw/<termId>/
 *     list/_meta.json              { termId, termLabel, termUrl, totalReports, pages, complete }
 *     list/page-0001.html ...      raw report-list pages (one per pagination page)
 *     reports/<reportId>/report.html
 *     reports/<reportId>/charts/<file>.png
 *
 * Stage 2 (parse) reads only the cache and writes the committed dataset:
 *
 *   apps/scraper/data/feedback/feedback.<termId>.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { FEEDBACK_DATA_DIR } from "../shared/paths.ts";

const FEEDBACK_CACHE_DIR = path.resolve(".cache", "feedback");
const RAW_DIR = path.join(FEEDBACK_CACHE_DIR, "raw");

export interface ListMeta {
  termId: string;
  termLabel: string;
  termUrl: string;
  totalReports: number | null;
  pages: number;
  complete: boolean;
}

function rawTermDir(termId: string): string {
  return path.join(RAW_DIR, termId);
}

function listDir(termId: string): string {
  return path.join(rawTermDir(termId), "list");
}

function listMetaPath(termId: string): string {
  return path.join(listDir(termId), "_meta.json");
}

function listPagePath(termId: string, pageIndex: number): string {
  return path.join(listDir(termId), `page-${String(pageIndex).padStart(4, "0")}.html`);
}

function reportDir(termId: string, reportId: string): string {
  return path.join(rawTermDir(termId), "reports", reportId);
}

function reportHtmlPath(termId: string, reportId: string): string {
  return path.join(reportDir(termId, reportId), "report.html");
}

export function outputPath(termId: string): string {
  return path.join(FEEDBACK_DATA_DIR, `feedback.${termId}.json`);
}

/**
 * Committed sidecar mapping each scale question's text to its ordinal response
 * labels (best-first). Labels are a per-question property, so they live here once
 * rather than being duplicated across every section in the per-term datasets.
 */
export function optionsPath(): string {
  return path.join(FEEDBACK_DATA_DIR, "feedback.options.json");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readListMeta(termId: string): Promise<ListMeta | null> {
  return readJsonFile<ListMeta>(listMetaPath(termId));
}

export async function writeListMeta(meta: ListMeta): Promise<void> {
  await writeJsonFile(listMetaPath(meta.termId), meta);
}

export async function listIsComplete(termId: string): Promise<boolean> {
  return (await readListMeta(termId))?.complete === true;
}

export async function reportIsCached(termId: string, reportId: string): Promise<boolean> {
  return exists(reportHtmlPath(termId, reportId));
}

export async function outputExists(termId: string): Promise<boolean> {
  return exists(outputPath(termId));
}

/** Read every cached list page for a term, in pagination order. */
export async function readListPages(termId: string): Promise<string[]> {
  const dir = listDir(termId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const pages = entries.filter((f) => /^page-\d+\.html$/.test(f)).sort();
  return Promise.all(pages.map((f) => fs.readFile(path.join(dir, f), "utf-8")));
}

export async function writeListPage(
  termId: string,
  pageIndex: number,
  html: string,
): Promise<void> {
  const p = listPagePath(termId, pageIndex);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, html, "utf-8");
}

/** Remove any cached list pages + meta for a term (before a fresh walk). */
export async function clearListCache(termId: string): Promise<void> {
  await fs.rm(listDir(termId), { recursive: true, force: true });
}

export async function writeReportHtml(
  termId: string,
  reportId: string,
  html: string,
): Promise<void> {
  const p = reportHtmlPath(termId, reportId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, html, "utf-8");
}

export async function readReportHtml(termId: string, reportId: string): Promise<string | null> {
  try {
    return await fs.readFile(reportHtmlPath(termId, reportId), "utf-8");
  } catch {
    return null;
  }
}

export async function writeChart(
  termId: string,
  reportId: string,
  fileName: string,
  data: Buffer,
): Promise<void> {
  const dir = path.join(reportDir(termId, reportId), "charts");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), data);
}

/**
 * Absolute path of a cached chart image, or `null` when it was never fetched.
 * `fileName` is the basename of the report's `chartUrl`.
 */
export async function chartPath(
  termId: string,
  reportId: string,
  fileName: string,
): Promise<string | null> {
  const p = path.join(reportDir(termId, reportId), "charts", fileName);
  return (await exists(p)) ? p : null;
}

/** Term ids that have a raw cache directory (any stage 1 output). */
export async function cachedTermIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(RAW_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}
