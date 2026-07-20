// HTML → LocalizedPage extraction: walks the uOttawa important-dates tab
// components/panels and pulls topic/date rows out of the overview + FAQ tables.

import * as cheerio from "cheerio";
import type {
  CheerioNode,
  LocalizedGroup,
  LocalizedPage,
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

export function extractLocalizedPage(input: {
  html: string;
  locale: SourceLocale;
  sourceUrl: string;
}): LocalizedPage {
  const $ = cheerio.load(input.html);
  const components = $("section.js-tabs")
    .toArray()
    .filter((component) => componentContainsImportantDatesTables($, component, input.locale));

  if (components.length === 0) {
    throw new Error(`No relevant important-dates tab components found at ${input.sourceUrl}`);
  }

  const terms: LocalizedTerm[] = [];
  for (const [componentIndex, component] of components.entries()) {
    const tabLabelsBySourceId = new Map<string, string>();
    $(component)
      .find('[role="tab"]')
      .each((_, tab) => {
        const sourceId = $(tab).attr("data-tab");
        if (!sourceId) return;
        tabLabelsBySourceId.set(sourceId, normalizeText($(tab).text()));
      });

    $(component)
      .find('[role="tabpanel"]')
      .each((_, panel) => {
        if (!panelContainsImportantDatesTables($, panel, input.locale)) {
          return;
        }
        const sourceId = getPanelSourceId($, panel);
        const label = tabLabelsBySourceId.get(sourceId);
        if (!label) {
          throw new Error(`Missing tab label for sourceId=${sourceId} at ${input.sourceUrl}`);
        }

        terms.push({
          sourceId,
          label,
          sourcePublished: componentIndex === 0 ? "true" : "false",
          sections: extractPanelSections($, panel, input.locale, input.sourceUrl, sourceId),
        });
      });
  }

  return {
    locale: input.locale,
    sourceUrl: input.sourceUrl,
    reviewedText: extractReviewedText($("body").text(), input.locale),
    terms,
  };
}

function componentContainsImportantDatesTables(
  $: cheerio.CheerioAPI,
  component: CheerioNode,
  locale: SourceLocale,
): boolean {
  return $(component)
    .find('[role="tabpanel"]')
    .toArray()
    .some((panel) => panelContainsImportantDatesTables($, panel, locale));
}

function panelContainsImportantDatesTables(
  $: cheerio.CheerioAPI,
  panel: CheerioNode,
  locale: SourceLocale,
): boolean {
  return $(panel)
    .find("table")
    .toArray()
    .some((table) => tableHasExpectedHeaders($, table, locale));
}

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

function getPanelSourceId($: cheerio.CheerioAPI, panel: CheerioNode): string {
  const dataTab = $(panel).attr("data-tab");
  if (dataTab) {
    return dataTab;
  }
  const panelId = $(panel).attr("id");
  if (panelId?.startsWith("tabpanel_")) {
    return panelId.slice("tabpanel_".length);
  }
  throw new Error("Important dates panel is missing a usable source identifier");
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
      const dateText = cells[1];
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
