/**
 * Bluera report-list parsing + Playwright pagination walk.
 *
 * Each list page renders ~8-10 report rows; every row is an anchor whose text is
 * the report title (prof + courses) and whose href opens the individual report.
 * The full set is paginated via ASP.NET WebForms postbacks (a "Go to next page"
 * submit button). We walk every page, handing the raw HTML to a callback so the
 * fetch stage can cache it; parsing happens later from the cache.
 */

import * as cheerio from "cheerio";
import type { Locator, Page } from "playwright";
import { normalizeWhitespace } from "../shared/text.ts";

export interface ListRow {
  /**
   * SelectedIDforPrint hash — unique per report, used to open the individual
   * report. `null` for reports that aren't eligible to open (e.g. too few
   * responses); their row is rendered as a disabled link with no href, but the
   * title (prof + course + section) is still present.
   */
  reportId: string | null;
  /** Report viewer href, relative to the term page (null for disabled rows). */
  href: string | null;
  /** Raw row title text (parsed later via title.ts). */
  title: string;
}

const SELECTED_ID_RE = /SelectedIDforPrint=([a-f0-9]+)/i;

export function parseTotalReports(html: string): number | null {
  const m = /of\s+([\d,]+)\s+Item/i.exec(html);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export interface ResultsRange {
  from: number;
  to: number;
  total: number;
}

/**
 * Parse the listing footer "Results: A - B of TOTAL Item(s)". This is the
 * authoritative signal for how far through the term we are: when `to >= total`
 * we are on the genuine last page. We rely on this rather than the "next"
 * button's visibility, which can render late under load and falsely look like
 * a last page (silent truncation).
 */
export function parseResultsRange(html: string): ResultsRange | null {
  const m = /Results:\s*([\d,]+)\s*-\s*([\d,]+)\s*of\s*([\d,]+)/i.exec(html);
  if (!m) return null;
  const num = (s: string) => Number(s.replace(/,/g, ""));
  return { from: num(m[1]), to: num(m[2]), total: num(m[3]) };
}

/** Stable per-row key (the report id when clickable, else the title text). */
export function rowKey(row: ListRow): string {
  return row.reportId ?? row.title;
}

export function parseListRows(html: string): ListRow[] {
  const $ = cheerio.load(html);
  const rows: ListRow[] = [];

  // Every report row — clickable or not — is an <a> carrying a `span.linkIcon`.
  // Clickable rows have an href with SelectedIDforPrint; ineligible reports
  // render as `<a disabled="disabled">` with no href. The listing renders each
  // row's anchor exactly once and the server paginates contiguously (no repeats
  // across pages), so we keep every anchor — distinct reports can legitimately
  // share an identical title (e.g. two report instances for one section), and
  // deduping by title would silently drop them.
  $("a").each((_, el) => {
    const $el = $(el);
    if ($el.find("span.linkIcon").length === 0) return;

    const href = $el.attr("href") ?? null;
    const idMatch = href ? SELECTED_ID_RE.exec(href) : null;
    const reportId = idMatch ? idMatch[1] : null;

    const $a = $el.clone();
    $a.find("span").remove();
    const title = normalizeWhitespace($a.text());
    if (!title) return;

    rows.push({ reportId, href: reportId ? href : null, title });
  });

  return rows;
}

// Enabled "Go to next page" submit buttons. The pager renders two (top `ctl01`,
// bottom `ctl14`); on the last page they carry `disabled`. We match either, and
// require it NOT be disabled. We deliberately do NOT gate on Playwright visibility:
// these are empty-value icon buttons sized via a CSS background image, which can
// fail to load under load and collapse the button to zero size — making Playwright
// consider it "hidden" even though it's a perfectly clickable submit. We trigger
// its postback via a native DOM click instead.
const NEXT_BUTTON_SELECTOR =
  "input[id$='_ctl01_btnNext']:not([disabled]), input[id$='_ctl14_btnNext']:not([disabled])";
const ADVANCE_TIMEOUT_MS = 45_000;
const NEXT_WAIT_TIMEOUT_MS = 20_000;
const CLICK_ATTEMPTS = 3;
const MAX_PAGES = 5000;

function firstRowId(html: string): string | null {
  const first = parseListRows(html)[0];
  return first ? rowKey(first) : null;
}

/**
 * Walk every report-list page starting from a loaded list page, invoking `onPage`
 * with each page's raw HTML (1-based index). Returns the number of pages visited.
 *
 * Robustness rules (a long term is hundreds of sequential ASP.NET postbacks, any of
 * which can be slow or drop under load):
 *  - Completion is decided by the listing footer ("Results: A - B of TOTAL"), never
 *    by the "next" button's visibility — under load the pager can render late and
 *    look like a last page, silently truncating the term. We only stop at `to >= total`.
 *  - Progress is measured by the monotonically-increasing `to` value, so a postback
 *    that resets the list to page 1 is NOT mistaken for an advance.
 *  - A click that doesn't advance is retried in place a few times before giving up,
 *    so one slow postback doesn't discard the whole term's cached pages.
 */
export async function walkListPages(
  page: Page,
  onPage: (html: string, pageIndex: number) => Promise<void>,
): Promise<number> {
  let pageIndex = 0;
  let prevTo = 0;
  while (pageIndex < MAX_PAGES) {
    const html = await page.content();
    pageIndex += 1;
    await onPage(html, pageIndex);

    const currentId = firstRowId(html);
    const range = parseResultsRange(html);
    if (range) prevTo = Math.max(prevTo, range.to);

    // Authoritative last-page check: we've shown the final item.
    if (range && range.total > 0 && range.to >= range.total) break;

    const advanced = await advanceToNextPage(page, range, currentId, prevTo, pageIndex);
    if (advanced === "last-page") break;
    if (advanced.to !== null) prevTo = Math.max(prevTo, advanced.to);
  }
  return pageIndex;
}

type AdvanceResult = "last-page" | { to: number | null };

/**
 * Click "next" and confirm the list actually advanced, retrying the click a few
 * times to ride out transient slow/dropped postbacks. Throws if it never advances.
 */
async function advanceToNextPage(
  page: Page,
  range: ResultsRange | null,
  previousId: string | null,
  prevTo: number,
  pageIndex: number,
): Promise<AdvanceResult> {
  for (let attempt = 1; attempt <= CLICK_ATTEMPTS; attempt += 1) {
    const next = await waitForEnabledNext(page);
    if (!next) {
      // No range info AND no next control → genuine last page (tiny terms can lack
      // the footer). With range info, retry; only a persistent absence is a stall.
      if (!range) return "last-page";
      if (attempt < CLICK_ATTEMPTS) continue;
      throw new Error(
        `pagination stalled after page ${pageIndex}: collected through item ` +
          `${String(prevTo)} of ${String(range.total)} but no enabled "next" control appeared`,
      );
    }

    await Promise.all([
      page.waitForLoadState("domcontentloaded").catch(() => {}),
      // Native DOM click submits the WebForms postback without Playwright's
      // actionability (visibility/size/stability) checks, which the icon button
      // can intermittently fail under load.
      next.evaluate((el) => (el as { click: () => void }).click()).catch(() => {}),
    ]);

    const newTo = await waitForAdvance(page, prevTo, previousId);
    if (newTo !== "no-change") return { to: newTo };
  }
  throw new Error(
    `pagination stalled after page ${pageIndex}: the list did not advance after ` +
      `${String(CLICK_ATTEMPTS)} attempts`,
  );
}

/**
 * Wait for an enabled "next" control to appear in the DOM, returning a handle to
 * it (or null if none renders within the timeout). We poll because the pager can
 * render after the rows under load. We do NOT filter on visibility — see
 * NEXT_BUTTON_SELECTOR — and click it via native DOM `click()`.
 */
async function waitForEnabledNext(page: Page): Promise<Locator | null> {
  const deadline = Date.now() + NEXT_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const next = page.locator(NEXT_BUTTON_SELECTOR).last();
    if ((await next.count()) > 0) return next;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * Poll until the list genuinely moves forward. Prefer the footer's `to` value
 * (monotonic — a reset to page 1 reads lower and is rejected); fall back to a
 * first-row-id change when the term has no footer. Returns the new `to` (or null
 * when only the first-row signal is available), or "no-change" on timeout.
 */
async function waitForAdvance(
  page: Page,
  prevTo: number,
  previousId: string | null,
): Promise<number | null | "no-change"> {
  const deadline = Date.now() + ADVANCE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const html = await page.content().catch(() => "");
    const range = parseResultsRange(html);
    if (range) {
      if (range.to > prevTo) return range.to;
    } else {
      const id = firstRowId(html);
      if (id && id !== previousId) return null;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return "no-change";
}
