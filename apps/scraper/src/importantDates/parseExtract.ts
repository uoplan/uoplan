// HTML → LocalizedTerm extraction: reads a uOttawa per-term important-dates page
// and pulls topic/date rows out of the overview + FAQ tables.

import * as cheerio from "cheerio";
import type {
  CheerioNode,
  LocalizedGroup,
  LocalizedRow,
  LocalizedSection,
  LocalizedTerm,
  SourceLocale,
} from "./parseTypes.ts";
import {
  extractPlainText,
  extractReviewedText,
  isHeaderArtifact,
  normalizeKey,
  normalizeText,
} from "./parseText.ts";

const SECTION_TOKEN_SELECTOR = "h1, h2, h3, h4, h5, h6, table";
const HEADER_LABELS = {
  en: ["topic", "dates"],
  fr: ["objet", "dates"],
} as const;
const OVERVIEW_LABELS = {
  en: "Overview",
  fr: "Aperçu",
} as const;

/**
 * Parse one per-term page (e.g. `/study/important-academic-dates-deadlines/fall-2026`).
 * uOttawa publishes one page per term; each has an overview table plus FAQ
 * accordions, the same structure the old single-page tab panels used.
 */
export function extractLocalizedTermPage(input: {
  html: string;
  locale: SourceLocale;
  sourceUrl: string;
  sourceId: string;
}): { term: LocalizedTerm; reviewedText: string | undefined } {
  const $ = cheerio.load(input.html);
  const main = $("main").first();
  const root = main.length > 0 ? main : $("body");

  const heading = normalizeText(root.find("h1").first().text());
  const label = heading.includes(" - ") ? heading.slice(heading.lastIndexOf(" - ") + 3).trim() : "";
  if (!label) {
    throw new Error(`Missing term label in page heading "${heading}" at ${input.sourceUrl}`);
  }

  return {
    term: {
      sourceId: input.sourceId,
      label,
      sourcePublished: "true",
      sections: extractPanelSections($, root[0], input.locale, input.sourceUrl, input.sourceId),
    },
    reviewedText: extractReviewedText(root.text(), input.locale),
  };
}

/** Collect the per-term page links from the important-dates index page. */
export function extractTermPageLinks(html: string, indexUrl: string): string[] {
  const $ = cheerio.load(html);
  const index = new URL(indexUrl);
  const links = new Set<string>();
  $("main a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const url = new URL(href, index);
    if (url.origin !== index.origin || url.pathname === index.pathname) return;
    if (!url.pathname.startsWith(`${index.pathname}/`)) return;
    const slug = url.pathname.slice(index.pathname.length + 1);
    if (!TERM_SLUG_RE.test(slug)) return;
    links.add(url.toString());
  });
  return [...links];
}

/** e.g. `fall-2026`, `spring-summer-2027`, `automne-2026`, `printemps-ete-2027`. */
const TERM_SLUG_RE = /^(?:winter|fall|spring-summer|hiver|automne|printemps-ete)-\d{4}$/;

function tableHasExpectedHeaders(
  $: cheerio.CheerioAPI,
  table: CheerioNode,
  locale: SourceLocale,
): boolean {
  const headerCells = $(table)
    .find("thead tr")
    .first()
    .find("th, td")
    .toArray()
    .map((cell) => normalizeKey(extractPlainText($, cell)));

  return (
    headerCells.length >= 2 &&
    headerCells[0] === HEADER_LABELS[locale][0] &&
    headerCells[1] === HEADER_LABELS[locale][1]
  );
}

function extractPanelSections(
  $: cheerio.CheerioAPI,
  panel: CheerioNode,
  locale: SourceLocale,
  sourceUrl: string,
  sourceId: string,
): LocalizedSection[] {
  const panelElement = $(panel);
  const overviewTable = panelElement
    .find("section.article-body-left table, section.article-body-left .table")
    .toArray()
    .find((table) => tableHasExpectedHeaders($, table, locale));

  if (!overviewTable) {
    throw new Error(`Missing overview table for sourceId=${sourceId} at ${sourceUrl}`);
  }

  const sections: LocalizedSection[] = [
    {
      label: OVERVIEW_LABELS[locale],
      groups: [{ rows: extractTableRows($, overviewTable) }],
    },
  ];

  panelElement.find("section.js-faq .faq--wrapper").each((_, wrapper) => {
    const label = normalizeText($(wrapper).find(".faq--headline").first().text());
    const groups = extractFaqGroups($, wrapper);
    if (!label || groups.length === 0) {
      return;
    }
    sections.push({ label, groups });
  });

  return sections;
}

function extractFaqGroups($: cheerio.CheerioAPI, wrapper: CheerioNode): LocalizedGroup[] {
  const content = $(wrapper).find(".faq__content, .js-accordion-content").first();
  const tokens = content.find(SECTION_TOKEN_SELECTOR).toArray();
  const groups: LocalizedGroup[] = [];
  let currentLabel: string | undefined;

  for (const token of tokens) {
    if (/^h[1-6]$/i.test(token.tagName)) {
      currentLabel = normalizeText($(token).text()) || undefined;
      continue;
    }
    if (token.tagName !== "table") {
      continue;
    }
    const rows = extractTableRows($, token);
    if (rows.length === 0) {
      groups.push({ ...(currentLabel ? { label: currentLabel } : {}), rows: [] });
      continue;
    }
    groups.push({ ...(currentLabel ? { label: currentLabel } : {}), rows });
  }

  return groups;
}

/**
 * uOttawa marks mid-term corrections as "Revised - November 27, 2026" /
 * "Date révisée - 27 novembre 2026". The date itself is what we want.
 */
function stripRevisedPrefix(dateText: string): string {
  return dateText.replace(/^(?:revised|date révisée)\s*-\s*/i, "");
}

function extractTableRows($: cheerio.CheerioAPI, table: CheerioNode): LocalizedRow[] {
  const tbodyRows = $(table).find("tbody tr").toArray();
  const rows = (
    tbodyRows.length > 0
      ? tbodyRows
      : $(table)
          .find("tr")
          .toArray()
          .filter((row) => $(row).parents("thead").length === 0)
  ) as CheerioNode[];

  return rows
    .map((row) => {
      const cells = $(row)
        .find("th, td")
        .toArray()
        .map((cell) => extractPlainText($, cell));

      if (cells.length < 2) {
        return null;
      }

      const topic = cells[0];
      const dateText = stripRevisedPrefix(cells[1]);
      if (!topic && !dateText) {
        return null;
      }
      if (isHeaderArtifact(topic, dateText)) {
        return null;
      }

      return { topic, dateText };
    })
    .filter((row): row is LocalizedRow => row !== null);
}
