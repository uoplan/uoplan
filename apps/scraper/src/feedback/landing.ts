/**
 * Parse the S-Reports landing page (uozone2 Drupal app) into the list of term
 * links it exposes. Each row links to a Bluera entry point for one term; the link
 * text is the season+year label which we map to a PeopleSoft STRM id.
 *
 * Link shapes observed:
 *   - newer: `a.aspx?s=<token>` / `a.aspx?l=<token>` (run the SSO/SAML chain)
 *   - older: direct `rpvl.aspx?rid=<guid>` / legacy `rpvlf.aspx?rid=<guid>`
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as cheerio from "cheerio";
import type { Got } from "got";
import { S_REPORTS_URL } from "./auth.ts";
import { normalizeWhitespace } from "../shared/text.ts";
import { labelToTermId } from "./termId.ts";

const LANDING_SNAPSHOT_PATH = path.join(".cache", "feedback", "landing.html");

export interface TermLink {
  /** Display label, e.g. "Fall 2025". */
  label: string;
  /** Absolute Bluera entry URL. */
  url: string;
  /** PeopleSoft STRM id, e.g. "2259". */
  termId: string;
  /** Whether this is the legacy `rpvlf.aspx` viewer (format may differ). */
  legacy: boolean;
}

export function parseLandingTermLinks(html: string): TermLink[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: TermLink[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.includes("bluera.com")) return;
    if (!/\.aspx\?/i.test(href)) return;

    const label = normalizeWhitespace($(el).text());
    const termId = labelToTermId(label);
    if (!termId) return;

    const url = href.replace(/^http:/, "https:");
    if (seen.has(termId)) return;
    seen.add(termId);

    links.push({ label, url, termId, legacy: /rpvlf\.aspx/i.test(href) });
  });

  return links;
}

export async function fetchLandingTermLinks(client: Got): Promise<TermLink[]> {
  // The uozone2 (Drupal) landing session is short-lived and intermittently bounces
  // to the SSO login even while the downstream Bluera session is still valid,
  // yielding zero links. The login flow snapshots the authenticated landing markup;
  // fall back to it (the Bluera entry URLs in it stay usable for the session).
  let links: TermLink[] = [];
  try {
    const res = await client.get(S_REPORTS_URL, { followRedirect: true });
    links = parseLandingTermLinks(res.body);
  } catch {
    // fall through to the snapshot
  }
  if (links.length > 0) return links;

  try {
    const html = await fs.readFile(LANDING_SNAPSHOT_PATH, "utf-8");
    const cached = parseLandingTermLinks(html);
    if (cached.length > 0) {
      console.log(
        `Live landing returned no terms; using ${String(cached.length)} from the ` +
          `cached login snapshot (${LANDING_SNAPSHOT_PATH}).`,
      );
      return cached;
    }
  } catch {
    // no snapshot available
  }
  return links;
}
