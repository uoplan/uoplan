import * as cheerio from "cheerio";
import type {
  ImportantDateCategory,
  ImportantDateGroup,
  ImportantDateItem,
  ImportantDatesData,
  ImportantDateSection,
  ImportantDateTerm,
  ScheduleReplacement,
} from "@uoplan/core/dataTypes";
import {
  classifyImportantDateEffect,
  isUndatedImportantDateText,
  parseImportantDateInterval,
  parseScheduleReplacement,
} from "./dateParser.ts";

type SourceLocale = "en" | "fr";

type ParseImportantDatesPagesInput = {
  enHtml: string;
  frHtml: string;
  enSourceUrl: string;
  frSourceUrl: string;
};

type LocalizedPage = {
  locale: SourceLocale;
  sourceUrl: string;
  reviewedText?: string;
  terms: LocalizedTerm[];
};

type LocalizedTerm = {
  sourceId: string;
  label: string;
  sourcePublished: "true" | "false";
  sections: LocalizedSection[];
};

type LocalizedSection = {
  label: string;
  groups: LocalizedGroup[];
};

type LocalizedGroup = {
  label?: string;
  rows: LocalizedRow[];
};

type LocalizedRow = {
  topic: string;
  dateText: string;
};

type CanonicalTerm = {
  sourceId: string;
  termId: string;
  label: string;
  season: ImportantDateTerm["season"];
  year: number;
  sourcePublished: "true" | "false";
  termInterval: ImportantDateTerm["termInterval"];
  courseInterval: ImportantDateTerm["courseInterval"];
  sections: ImportantDateSection[];
  sessions: ImportantDateTerm["sessions"];
};

type TermContext = Pick<ImportantDateTerm, "season" | "year">;
type CheerioNode = NonNullable<Parameters<cheerio.CheerioAPI>[0]>;

const SECTION_TOKEN_SELECTOR = "h1, h2, h3, h4, h5, h6, table";
const HEADER_LABELS = {
  en: ["topic", "dates"],
  fr: ["objet", "dates"],
} as const;
const OVERVIEW_LABELS = {
  en: "Overview",
  fr: "Aperçu",
} as const;
const SEASON_ORDER: Readonly<Record<ImportantDateTerm["season"], number>> = {
  winter: 0,
  "spring-summer": 1,
  fall: 2,
};
// Matches an overview "Courses (Session X)" structural row, distinct from the
// plain "Course dates" row used by standard (non-sessioned) Winter/Fall terms.
const SESSION_TOPIC_PATTERN = /^Courses\s*\(Session\s+([A-Za-z])\)$/i;
// Matches a nested group heading such as "Session A (May 4 to July 24)".
const SESSION_LABEL_PATTERN = /^Session\s+([A-Za-z])\b/i;

export function parseImportantDatesPages(input: ParseImportantDatesPagesInput): {
  en: ImportantDatesData;
  fr: ImportantDatesData;
} {
  const englishPage = extractLocalizedPage({
    html: input.enHtml,
    locale: "en",
    sourceUrl: input.enSourceUrl,
  });
  const frenchPage = extractLocalizedPage({
    html: input.frHtml,
    locale: "fr",
    sourceUrl: input.frSourceUrl,
  });

  const canonicalTerms = englishPage.terms
    .map((term) => buildCanonicalTerm(term, englishPage.sourceUrl))
    .sort(compareTermsChronologically);

  validateUniqueCanonicalIds(canonicalTerms, englishPage.sourceUrl);

  const frenchTermsBySourceId = new Map(frenchPage.terms.map((term) => [term.sourceId, term]));
  const matchedFrenchIds = new Set<string>();

  const englishTerms: ImportantDateTerm[] = [];
  const frenchTerms: ImportantDateTerm[] = [];

  for (const canonicalTerm of canonicalTerms) {
    const localizedFrenchTerm = frenchTermsBySourceId.get(canonicalTerm.sourceId);
    if (!localizedFrenchTerm) {
      throw new Error(
        `Missing French term for sourceId=${canonicalTerm.sourceId} at ${frenchPage.sourceUrl}`,
      );
    }
    matchedFrenchIds.add(canonicalTerm.sourceId);

    englishTerms.push({
      sourceId: canonicalTerm.sourceId,
      termId: canonicalTerm.termId,
      label: canonicalTerm.label,
      season: canonicalTerm.season,
      year: canonicalTerm.year,
      sourcePublished: canonicalTerm.sourcePublished,
      termInterval: canonicalTerm.termInterval,
      courseInterval: canonicalTerm.courseInterval,
      sections: canonicalTerm.sections,
      sessions: canonicalTerm.sessions,
    });

    frenchTerms.push(
      buildLocalizedTerm({
        canonicalTerm,
        localizedTerm: localizedFrenchTerm,
        localizedPage: frenchPage,
      }),
    );
  }

  for (const frenchTerm of frenchPage.terms) {
    if (!matchedFrenchIds.has(frenchTerm.sourceId)) {
      throw new Error(
        `Unexpected French term without English match for sourceId=${frenchTerm.sourceId} at ${frenchPage.sourceUrl}`,
      );
    }
  }

  return {
    en: {
      locale: "en",
      sourceUrl: englishPage.sourceUrl,
      ...(englishPage.reviewedText ? { reviewedText: englishPage.reviewedText } : {}),
      terms: englishTerms,
    },
    fr: {
      locale: "fr-CA",
      sourceUrl: frenchPage.sourceUrl,
      ...(frenchPage.reviewedText ? { reviewedText: frenchPage.reviewedText } : {}),
      terms: frenchTerms,
    },
  };
}

function extractLocalizedPage(input: {
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

function buildCanonicalTerm(localizedTerm: LocalizedTerm, sourceUrl: string): CanonicalTerm {
  const { season, year } = parseEnglishTermLabel(localizedTerm.label);
  const context: TermContext = { season, year };

  const sections = localizedTerm.sections.map((section, sectionIndex) =>
    buildCanonicalSection({
      sourceId: localizedTerm.sourceId,
      section,
      sectionIndex,
      context,
      sourcePublished: localizedTerm.sourcePublished,
      sourceUrl,
    }),
  );

  const overview = sections[0];
  const overviewItems = overview.groups.flatMap((group) => group.items);
  const termInterval = extractRequiredOverviewInterval({
    sourceId: localizedTerm.sourceId,
    sourceUrl,
    sourcePublished: localizedTerm.sourcePublished,
    items: overviewItems,
    requiredKind: "term",
  });
  const courseInterval = extractRequiredOverviewInterval({
    sourceId: localizedTerm.sourceId,
    sourceUrl,
    sourcePublished: localizedTerm.sourcePublished,
    items: overviewItems,
    requiredKind: "course",
  });
  const sessions = extractSessionDefinitions({
    sourceId: localizedTerm.sourceId,
    sourceUrl,
    items: overviewItems,
  });

  validateSessionReferences({
    sourceId: localizedTerm.sourceId,
    sourceUrl,
    sourcePublished: localizedTerm.sourcePublished,
    sections,
    sessions,
  });

  return {
    sourceId: localizedTerm.sourceId,
    termId: createPeopleSoftTermId(year, season),
    label: localizedTerm.label,
    season,
    year,
    sourcePublished: localizedTerm.sourcePublished,
    termInterval,
    courseInterval,
    sections,
    sessions,
  };
}

function buildCanonicalSection(input: {
  sourceId: string;
  section: LocalizedSection;
  sectionIndex: number;
  context: TermContext;
  sourcePublished: "true" | "false";
  sourceUrl: string;
}): ImportantDateSection {
  const category =
    input.sectionIndex === 0 ? "overview" : mapCategoryFromEnglishLabel(input.section.label);

  return {
    id: `${input.sourceId}:${category}`,
    label: input.section.label,
    category,
    groups: input.section.groups.map((group, groupIndex) =>
      buildCanonicalGroup({
        sourceId: input.sourceId,
        category,
        group,
        groupIndex,
        context: input.context,
        sourcePublished: input.sourcePublished,
        sourceUrl: input.sourceUrl,
      }),
    ),
  };
}

function buildCanonicalGroup(input: {
  sourceId: string;
  category: ImportantDateCategory;
  group: LocalizedGroup;
  groupIndex: number;
  context: TermContext;
  sourcePublished: "true" | "false";
  sourceUrl: string;
}): ImportantDateGroup {
  const sessionCode = extractSessionCodeFromGroupLabel(input.group.label);
  return {
    id: `${input.sourceId}:${input.category}:g${input.groupIndex}`,
    ...(input.group.label ? { label: input.group.label } : {}),
    ...(sessionCode ? { sessionCode } : {}),
    items: input.group.rows.map((row, rowIndex) =>
      buildCanonicalItem({
        sourceId: input.sourceId,
        category: input.category,
        row,
        groupIndex: input.groupIndex,
        rowIndex,
        context: input.context,
        sourcePublished: input.sourcePublished,
        sourceUrl: input.sourceUrl,
      }),
    ),
  };
}

function buildCanonicalItem(input: {
  sourceId: string;
  category: ImportantDateCategory;
  row: LocalizedRow;
  groupIndex: number;
  rowIndex: number;
  context: TermContext;
  sourcePublished: "true" | "false";
  sourceUrl: string;
}): ImportantDateItem {
  const contextLabel = formatRowContext(input);
  let interval: ImportantDateItem["interval"];
  try {
    interval = parseImportantDateInterval(input.row.dateText, input.context) ?? undefined;
  } catch (error) {
    throw new Error(
      `${contextLabel} failed to parse date interval "${input.row.dateText}": ${getErrorMessage(error)}`,
    );
  }

  if (
    input.sourcePublished === "true" &&
    !interval &&
    !isUndatedImportantDateText(input.row.dateText)
  ) {
    throw new Error(
      `${contextLabel} unsupported current date text "${input.row.dateText}" at ${input.sourceUrl}`,
    );
  }

  let replacement: ScheduleReplacement | undefined;
  if (input.category === "schedule_changes") {
    let parsedReplacement;
    try {
      parsedReplacement = parseScheduleReplacement(input.row.topic, input.context);
    } catch (error) {
      throw new Error(
        `${contextLabel} failed to parse schedule-change topic "${input.row.topic}": ${getErrorMessage(error)}`,
      );
    }

    if (
      input.sourcePublished === "true" &&
      !isUndatedImportantDateText(input.row.dateText) &&
      parsedReplacement.kind !== "parsed"
    ) {
      throw new Error(
        `${contextLabel} unsupported current schedule-change row at ${input.sourceUrl}: topic="${input.row.topic}" dateText="${input.row.dateText}"`,
      );
    }

    if (parsedReplacement.kind === "parsed") {
      replacement = parsedReplacement.replacement;
    }
  }

  const effect = classifyImportantDateEffect({
    category: input.category,
    topic: input.row.topic,
    dateText: input.row.dateText,
    ...(replacement ? { scheduleReplacement: replacement } : {}),
  });

  return {
    id: `${input.sourceId}:${input.category}:g${input.groupIndex}:r${input.rowIndex}`,
    topic: input.row.topic,
    dateText: input.row.dateText,
    effect,
    ...(interval ? { interval } : {}),
    ...(replacement ? { replacement } : {}),
  };
}

function buildLocalizedTerm(input: {
  canonicalTerm: CanonicalTerm;
  localizedTerm: LocalizedTerm;
  localizedPage: LocalizedPage;
}): ImportantDateTerm {
  const sections = input.canonicalTerm.sections.map((canonicalSection, sectionIndex) => {
    const localizedSection = input.localizedTerm.sections[sectionIndex];
    if (!localizedSection) {
      throw structuralDriftError({
        sourceUrl: input.localizedPage.sourceUrl,
        sourceId: input.canonicalTerm.sourceId,
        category: canonicalSection.category,
        message: `missing localized section at index ${sectionIndex}`,
      });
    }

    const groups = canonicalSection.groups.map((canonicalGroup, groupIndex) => {
      const localizedGroup = localizedSection.groups[groupIndex];
      if (!localizedGroup) {
        throw structuralDriftError({
          sourceUrl: input.localizedPage.sourceUrl,
          sourceId: input.canonicalTerm.sourceId,
          category: canonicalSection.category,
          group: groupIndex,
          message: `missing localized group at index ${groupIndex}`,
        });
      }

      const items = canonicalGroup.items.map((canonicalItem, rowIndex) => {
        const localizedRow = localizedGroup.rows[rowIndex];
        if (!localizedRow) {
          if (input.canonicalTerm.sourcePublished === "false") {
            return {
              ...canonicalItem,
              topic: canonicalItem.topic,
              dateText: canonicalItem.dateText,
              usedEnglishFallback: true,
            };
          }
          throw structuralDriftError({
            sourceUrl: input.localizedPage.sourceUrl,
            sourceId: input.canonicalTerm.sourceId,
            category: canonicalSection.category,
            group: groupIndex,
            row: rowIndex,
            message: `missing localized row at index ${rowIndex}`,
          });
        }

        return {
          ...canonicalItem,
          topic: localizedRow.topic,
          dateText: localizedRow.dateText,
        };
      });

      if (localizedGroup.rows.length > canonicalGroup.items.length) {
        throw structuralDriftError({
          sourceUrl: input.localizedPage.sourceUrl,
          sourceId: input.canonicalTerm.sourceId,
          category: canonicalSection.category,
          group: groupIndex,
          row: canonicalGroup.items.length,
          message: "unexpected extra localized rows",
        });
      }

      return {
        id: canonicalGroup.id,
        ...((localizedGroup.label ?? canonicalGroup.label)
          ? { label: localizedGroup.label ?? canonicalGroup.label }
          : {}),
        ...(canonicalGroup.sessionCode ? { sessionCode: canonicalGroup.sessionCode } : {}),
        items,
      };
    });

    if (localizedSection.groups.length > canonicalSection.groups.length) {
      throw structuralDriftError({
        sourceUrl: input.localizedPage.sourceUrl,
        sourceId: input.canonicalTerm.sourceId,
        category: canonicalSection.category,
        group: canonicalSection.groups.length,
        message: "unexpected extra localized groups",
      });
    }

    return {
      id: canonicalSection.id,
      label: localizedSection.label,
      category: canonicalSection.category,
      groups,
    };
  });

  if (input.localizedTerm.sections.length > input.canonicalTerm.sections.length) {
    throw structuralDriftError({
      sourceUrl: input.localizedPage.sourceUrl,
      sourceId: input.canonicalTerm.sourceId,
      category: "other",
      message: "unexpected extra localized sections",
    });
  }

  return {
    sourceId: input.canonicalTerm.sourceId,
    termId: input.canonicalTerm.termId,
    label: input.localizedTerm.label,
    season: input.canonicalTerm.season,
    year: input.canonicalTerm.year,
    sourcePublished: input.canonicalTerm.sourcePublished,
    termInterval: input.canonicalTerm.termInterval,
    courseInterval: input.canonicalTerm.courseInterval,
    sections,
    sessions: input.canonicalTerm.sessions,
  };
}

function extractRequiredOverviewInterval(input: {
  sourceId: string;
  sourceUrl: string;
  sourcePublished: "true" | "false";
  items: ImportantDateItem[];
  requiredKind: "term" | "course";
}): ImportantDateTerm["termInterval"] {
  const matchingIntervals = input.items
    .filter((item) => isOverviewTopicMatch(item.topic, input.requiredKind))
    .map((item) => item.interval)
    .filter((interval): interval is NonNullable<typeof interval> => interval !== undefined);

  if (matchingIntervals.length === 0) {
    throw new Error(
      `Missing ${input.requiredKind} structural interval for sourceId=${input.sourceId} at ${input.sourceUrl}`,
    );
  }

  if (input.requiredKind === "term") {
    return matchingIntervals[0];
  }

  return mergeIntervals(matchingIntervals);
}

function mergeIntervals(
  intervals: ImportantDateItem["interval"][],
): ImportantDateTerm["courseInterval"] {
  const resolved = intervals.filter(
    (interval): interval is NonNullable<typeof interval> => interval !== undefined,
  );
  let start = resolved[0];
  let end = resolved[0];

  for (const interval of resolved.slice(1)) {
    if (interval.startDate < start.startDate) {
      start = interval;
    }
    if (interval.endDate > end.endDate) {
      end = interval;
    }
  }

  return {
    startDate: start.startDate,
    endDate: end.endDate,
  };
}

function isOverviewTopicMatch(topic: string, requiredKind: "term" | "course"): boolean {
  const normalized = normalizeKey(topic);
  if (requiredKind === "term") {
    return normalized === "term dates";
  }
  return normalized === "course dates" || normalized.startsWith("courses ");
}

function extractSessionCodeFromTopic(topic: string): string | undefined {
  const match = SESSION_TOPIC_PATTERN.exec(normalizeText(topic));
  return match ? match[1].toUpperCase() : undefined;
}

function extractSessionCodeFromGroupLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const match = SESSION_LABEL_PATTERN.exec(normalizeText(label));
  return match ? match[1].toUpperCase() : undefined;
}

// Derives the term's named-session definitions from English overview rows
// shaped "Courses (Session X)" (e.g. Spring-Summer's A/B/C/…). Standard
// Winter/Fall "Course dates" rows never match and so never create a session.
function extractSessionDefinitions(input: {
  sourceId: string;
  sourceUrl: string;
  items: ImportantDateItem[];
}): ImportantDateTerm["sessions"] {
  const sessions: ImportantDateTerm["sessions"] = [];
  const seenCodes = new Set<string>();

  for (const item of input.items) {
    const code = extractSessionCodeFromTopic(item.topic);
    if (!code) continue;

    if (seenCodes.has(code)) {
      throw new Error(
        `Duplicate important-date session definition "${code}" for sourceId=${input.sourceId} at ${input.sourceUrl}`,
      );
    }
    if (!item.interval) {
      throw new Error(
        `Missing course interval for important-date session "${code}" for sourceId=${input.sourceId} at ${input.sourceUrl}`,
      );
    }

    seenCodes.add(code);
    sessions.push({ code, courseInterval: item.interval });
  }

  return sessions;
}

// A scoped group (sessionCode set from its "Session X" heading) must reference
// a session actually defined by the term's overview. Only enforced for
// currently published terms — archived terms keep parsing their existing real
// data even if the source ever mislabelled a group.
function validateSessionReferences(input: {
  sourceId: string;
  sourceUrl: string;
  sourcePublished: "true" | "false";
  sections: ImportantDateSection[];
  sessions: ImportantDateTerm["sessions"];
}): void {
  if (input.sourcePublished !== "true") return;

  const definedCodes = new Set(input.sessions.map((session) => session.code));

  for (const section of input.sections) {
    for (const [groupIndex, group] of section.groups.entries()) {
      if (group.sessionCode && !definedCodes.has(group.sessionCode)) {
        throw new Error(
          `Important dates group references undefined session "${group.sessionCode}" ` +
            `[sourceId=${input.sourceId} category=${section.category} group=${groupIndex}] at ${input.sourceUrl}`,
        );
      }
    }
  }
}

function parseEnglishTermLabel(label: string): {
  season: ImportantDateTerm["season"];
  year: number;
} {
  const match = /^(Winter|Spring-Summer|Fall) (\d{4})$/i.exec(label);
  if (!match) {
    throw new Error(`Unsupported English important-dates term label: ${label}`);
  }

  const seasonLabel = match[1].toLowerCase();
  const year = Number.parseInt(match[2], 10);
  const season =
    seasonLabel === "winter"
      ? "winter"
      : seasonLabel === "spring-summer"
        ? "spring-summer"
        : "fall";

  return { season, year };
}

function createPeopleSoftTermId(year: number, season: ImportantDateTerm["season"]): string {
  const suffix = season === "winter" ? "1" : season === "spring-summer" ? "5" : "9";
  return `2${String(year).slice(-2)}${suffix}`;
}

function compareTermsChronologically(a: CanonicalTerm, b: CanonicalTerm): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
}

function mapCategoryFromEnglishLabel(label: string): ImportantDateCategory {
  const normalized = normalizeKey(label);
  if (normalized === "statutory holidays, breaks and special events") return "breaks";
  if (normalized === "changes to regular course schedule") return "schedule_changes";
  if (normalized === "enrolment, courses, withdrawals and reimbursements") return "enrolment";
  if (normalized === "grades and exams") return "grades_exams";
  if (normalized === "tuition fee payment") return "tuition";
  if (normalized === "student services") return "student_services";
  if (
    normalized === "reports, major research papers, and theses (graduate studies)" ||
    normalized === "reports, major research papers and theses (graduate studies)"
  ) {
    return "graduate_reports";
  }
  if (
    normalized.startsWith("training on academic integrity") ||
    normalized.startsWith("mandatory training on academic integrity")
  ) {
    return "academic_integrity";
  }
  if (normalized.startsWith("making changes to your program")) {
    return "program_changes";
  }
  return "other";
}

function validateUniqueCanonicalIds(terms: CanonicalTerm[], sourceUrl: string): void {
  const seen = new Set<string>();

  for (const term of terms) {
    for (const section of term.sections) {
      for (const group of section.groups) {
        for (const item of group.items) {
          if (seen.has(item.id)) {
            throw new Error(
              `Duplicate canonical important-date item id "${item.id}" at ${sourceUrl}`,
            );
          }
          seen.add(item.id);
        }
      }
    }
  }
}

function structuralDriftError(input: {
  sourceUrl: string;
  sourceId: string;
  category: ImportantDateCategory;
  message: string;
  group?: number;
  row?: number;
}): Error {
  const parts = [
    `Unexpected locale structural drift at ${input.sourceUrl}`,
    `sourceId=${input.sourceId}`,
    `category=${input.category}`,
  ];
  if (input.group !== undefined) {
    parts.push(`group=${input.group}`);
  }
  if (input.row !== undefined) {
    parts.push(`row=${input.row}`);
  }
  parts.push(input.message);
  return new Error(parts.join(" "));
}

function formatRowContext(input: {
  sourceId: string;
  category: ImportantDateCategory;
  groupIndex: number;
  rowIndex: number;
}): string {
  return `[sourceId=${input.sourceId} category=${input.category} group=${input.groupIndex} row=${input.rowIndex}]`;
}

function normalizeText(text: string): string {
  return text
    .replaceAll(/[\u00A0\u202F]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeKey(text: string): string {
  return normalizeText(text).toLowerCase().replaceAll("’", "'").replaceAll("–", "-");
}

function extractPlainText($: cheerio.CheerioAPI, node: CheerioNode): string {
  const clone = $(node).clone();
  clone.find("br").replaceWith(" ");
  clone.find("p, div, li, ul, ol").each((_, element) => {
    $(element).append(" ");
  });
  return normalizeText(clone.text());
}

function isHeaderArtifact(topic: string, dateText: string): boolean {
  const normalizedTopic = normalizeKey(topic);
  const normalizedDateText = normalizeKey(dateText);
  return (
    (normalizedTopic === "topic" && normalizedDateText === "dates") ||
    (normalizedTopic === "objet" && normalizedDateText === "dates")
  );
}

function extractReviewedText(bodyText: string, locale: SourceLocale): string | undefined {
  const normalized = normalizeText(bodyText);
  const match =
    locale === "en"
      ? normalized.match(/Last reviewed:\s*([A-Za-z]+\s+\d{4})/)
      : normalized.match(/Dernière mise à jour\s*:?\s*([A-Za-zÀ-ÿ]+\s+\d{4})/);

  return match?.[1];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
