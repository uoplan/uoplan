/**
 * Parse the S-Reports landing page (uozone2 Drupal app) into the list of term
 * links it exposes. Each row links to a Bluera entry point for one term; the link
 * text is the season+year label which we map to a PeopleSoft STRM id.
 *
 * Link shapes observed:
 *   - newer: `a.aspx?s=<token>` / `a.aspx?l=<token>` (run the SSO/SAML chain)
 *   - older: direct `rpvl.aspx?rid=<guid>` / legacy `rpvlf.aspx?rid=<guid>`
 */

import * as cheerio from "cheerio";
import type { Got } from "got";
import { S_REPORTS_URL } from "./auth.ts";
import { normalizeWhitespace } from "../shared/text.ts";
import { labelToTermId } from "./termId.ts";

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
  const res = await client.get(S_REPORTS_URL, { followRedirect: true });
  return parseLandingTermLinks(res.body);
}
