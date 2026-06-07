/**
 * Stage 1 — fetch. Download raw course-evaluation artifacts into the gitignored
 * cache, skipping anything already saved (unless `force`). No parsing happens here:
 * an interrupted or failed run can be resumed without re-downloading, and the parse
 * stage runs entirely offline against the cache.
 *
 *   - List pages (always): walk every report-list page for each term, saving raw HTML.
 *   - Reports + charts (only with `stats`): open each report, save its HTML and
 *     download the bar-chart PNGs.
 */

import { URL } from "node:url";
import pLimit from "p-limit";
import type { Browser, BrowserContext, Page } from "playwright";
import { getAuthenticatedClient, launchBrowser, newAuthedContext } from "./auth.ts";
import {
  clearListCache,
  listIsComplete,
  readListPages,
  reportIsCached,
  writeChart,
  writeListMeta,
  writeListPage,
  writeReportHtml,
} from "./cache.ts";
import { fetchLandingTermLinks, type TermLink } from "./landing.ts";
import { parseListRows, parseTotalReports, walkListPages } from "./list.ts";
import { getErrorMessage } from "../shared/errors.ts";
import type { StoredSession } from "./keychain.ts";

export interface FetchOptions {
  /** Term ids to fetch; default = every term the landing page exposes. */
  terms?: string[];
  /** Re-fetch terms/reports even if already cached. */
  force?: boolean;
  /** Also fetch per-report stats HTML + chart PNGs. */
  stats?: boolean;
  /** Cap reports fetched per term (smoke testing). */
  maxReports?: number;
  /** Number of terms to fetch in parallel (default 4, or 2 with stats). */
  concurrency?: number;
}

const LIST_READY_SELECTOR = 'a[href*="SelectedIDforPrint"]';
const ENTER_TIMEOUT_MS = 60_000;
const REPORT_TIMEOUT_MS = 45_000;
const REPORT_DELAY_MS = 250;

function selectTerms(links: TermLink[], wanted?: string[]): TermLink[] {
  if (!wanted || wanted.length === 0) return links;
  const set = new Set(wanted);
  return links.filter((l) => set.has(l.termId));
}

/** Navigate a term entry link, clearing any SAML "continue" interstitial. */
async function enterTerm(page: Page, termUrl: string): Promise<void> {
  await page.goto(termUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

  for (let attempt = 0; attempt < 3; attempt++) {
    const ready = await page
      .waitForSelector(LIST_READY_SELECTOR, { timeout: ENTER_TIMEOUT_MS / 3 })
      .then(() => true)
      .catch(() => false);
    if (ready) return;

    // SAML auto-POST interstitial ("Working... Click Submit to continue").
    const submit = page.locator('input[type="submit"], button[type="submit"]').first();
    if ((await submit.count()) > 0) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded").catch(() => {}),
        submit.click().catch(() => {}),
      ]);
    }
  }

  await page.waitForSelector(LIST_READY_SELECTOR, { timeout: ENTER_TIMEOUT_MS });
}

async function fetchTermList(
  context: BrowserContext,
  term: TermLink,
): Promise<{ reportUrls: { reportId: string; url: string }[] }> {
  const page = await context.newPage();
  try {
    await enterTerm(page, term.url);
    const origin = page.url();
    await clearListCache(term.termId);

    let totalReports: number | null = null;
    const reportUrls: { reportId: string; url: string }[] = [];
    let rowCount = 0;

    const pages = await walkListPages(page, async (html, pageIndex) => {
      await writeListPage(term.termId, pageIndex, html);
      if (totalReports === null) totalReports = parseTotalReports(html);
      for (const row of parseListRows(html)) {
        rowCount += 1;
        // Only clickable rows have an openable report (for the --stats path);
        // disabled rows still contribute their title metadata via the cache.
        if (row.reportId && row.href) {
          reportUrls.push({ reportId: row.reportId, url: new URL(row.href, origin).toString() });
        }
      }
    });

    const total: number | null = totalReports;

    // Correctness backstop: never persist a "complete" list that collected far fewer
    // rows than the portal reported for the term. Count ALL rows (clickable +
    // ineligible), since `total` includes both. Throwing here leaves the term
    // un-cached so a re-run retries it instead of baking in a truncated dataset.
    if (total != null && rowCount < total - 1) {
      throw new Error(
        `incomplete walk for ${term.termId}: collected ${String(rowCount)} of ${String(total)} ` +
          `reports across ${pages} page(s)`,
      );
    }

    await writeListMeta({
      termId: term.termId,
      termLabel: term.label,
      termUrl: term.url,
      totalReports: total,
      pages,
      complete: true,
    });

    const reportedSuffix = total == null ? "" : ` of ${String(total)} reported`;
    console.log(
      `  [${term.termId}] ${term.label}: cached ${pages} list page(s), ` +
        `${String(rowCount)} report(s)${reportedSuffix} (${reportUrls.length} openable)`,
    );
    return { reportUrls };
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchReport(
  context: BrowserContext,
  termId: string,
  reportId: string,
  reportUrl: string,
): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(reportUrl, { waitUntil: "domcontentloaded", timeout: REPORT_TIMEOUT_MS });
    // Clear a SAML interstitial if the viewer bounced through one.
    const submit = page.locator('input[type="submit"], button[type="submit"]').first();
    if ((await submit.count()) > 0 && (await page.locator(".report-block").count()) === 0) {
      await Promise.all([
        page.waitForLoadState("domcontentloaded").catch(() => {}),
        submit.click().catch(() => {}),
      ]);
    }
    await page.waitForSelector(".report-block", { timeout: REPORT_TIMEOUT_MS }).catch(() => {});

    const html = await page.content();
    await writeReportHtml(termId, reportId, html);

    const origin = new URL(page.url()).origin;
    const chartSrcs = await page.$$eval(".FrequencyBlock_chart img", (imgs) =>
      imgs.map((img) => img.getAttribute("src")).filter((s): s is string => !!s),
    );
    for (const src of chartSrcs) {
      const url = new URL(src, origin).toString();
      const fileName = url.split("/").pop() ?? `${reportId}.png`;
      try {
        const res = await context.request.get(url);
        if (res.ok()) await writeChart(termId, reportId, fileName, Buffer.from(await res.body()));
      } catch {
        // Chart download is best-effort.
      }
    }
  } finally {
    await page.close().catch(() => {});
  }
}

async function processTerm(
  browser: Browser,
  session: StoredSession,
  term: TermLink,
  options: FetchOptions,
): Promise<void> {
  // Each term gets its own isolated context so concurrent ASP.NET postbacks across
  // terms never share viewstate/session and clobber each other's pagination.
  const context = await newAuthedContext(browser, session);
  try {
    let reportUrls: { reportId: string; url: string }[] = [];

    if (!options.force && (await listIsComplete(term.termId))) {
      console.log(`  [${term.termId}] ${term.label}: list already cached, skipping fetch.`);
      if (options.stats) {
        reportUrls = await reportUrlsFromCache(context, term);
      }
    } else {
      ({ reportUrls } = await fetchTermList(context, term));
    }

    if (!options.stats) return;

    const limited =
      options.maxReports != null ? reportUrls.slice(0, options.maxReports) : reportUrls;
    let fetched = 0;
    let skipped = 0;
    for (const { reportId, url } of limited) {
      if (!options.force && (await reportIsCached(term.termId, reportId))) {
        skipped += 1;
        continue;
      }
      try {
        await fetchReport(context, term.termId, reportId, url);
        fetched += 1;
      } catch (err) {
        console.warn(`    report ${reportId} failed: ${getErrorMessage(err)}`);
      }
      await new Promise((r) => setTimeout(r, REPORT_DELAY_MS));
    }
    console.log(
      `  [${term.termId}] stats: fetched ${fetched}, skipped ${skipped} cached report(s).`,
    );
  } finally {
    await context.close().catch(() => {});
  }
}

export async function runFetch(options: FetchOptions = {}): Promise<void> {
  const { client, session } = await getAuthenticatedClient();
  const links = await fetchLandingTermLinks(client);
  const terms = selectTerms(links, options.terms);

  if (terms.length === 0) {
    console.warn("No matching terms found on the landing page.");
    return;
  }
  const concurrency = Math.max(1, options.concurrency ?? (options.stats ? 2 : 4));
  console.log(
    `Fetching ${terms.length} term(s)${options.stats ? " with stats" : ""} ` +
      `(${concurrency} in parallel)...`,
  );

  const { browser } = await launchBrowser();
  const limit = pLimit(concurrency);
  try {
    await Promise.all(
      terms.map((term) =>
        limit(async () => {
          try {
            await processTerm(browser, session, term, options);
          } catch (err) {
            console.warn(`  [${term.termId}] ${term.label} failed: ${getErrorMessage(err)}`);
          }
        }),
      ),
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Re-derive report urls from the already-cached list pages (for a stats-only pass). */
async function reportUrlsFromCache(
  context: BrowserContext,
  term: TermLink,
): Promise<{ reportId: string; url: string }[]> {
  const pages = await readListPages(term.termId);
  if (pages.length === 0) return [];

  // The cached hrefs are relative; resolve them against the live term origin.
  const page = await context.newPage();
  let origin: string;
  try {
    await enterTerm(page, term.url);
    origin = page.url();
  } finally {
    await page.close().catch(() => {});
  }

  const out: { reportId: string; url: string }[] = [];
  for (const html of pages) {
    for (const row of parseListRows(html)) {
      if (row.reportId && row.href) {
        out.push({ reportId: row.reportId, url: new URL(row.href, origin).toString() });
      }
    }
  }
  return out;
}
