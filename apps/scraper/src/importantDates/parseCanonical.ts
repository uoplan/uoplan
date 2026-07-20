// LocalizedTerm → CanonicalTerm: parses date intervals, derives term identity
// (season/year/PeopleSoft id), maps FAQ section labels to categories, and
// validates canonical item-id uniqueness.

import type {
  ImportantDateCategory,
  ImportantDateGroup,
  ImportantDateItem,
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
import type {
  CanonicalTerm,
  LocalizedGroup,
  LocalizedSection,
  LocalizedTerm,
  TermContext,
} from "./parseTypes.ts";
import { formatRowContext, getErrorMessage, normalizeKey } from "./parseText.ts";
import {
  extractSessionCodeFromGroupLabel,
  extractSessionDefinitions,
  validateSessionReferences,
} from "./parseSessions.ts";

const SEASON_ORDER: Readonly<Record<ImportantDateTerm["season"], number>> = {
  winter: 0,
  "spring-summer": 1,
  fall: 2,
};

export function buildCanonicalTerm(localizedTerm: LocalizedTerm, sourceUrl: string): CanonicalTerm {
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
  row: { topic: string; dateText: string };
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

export function compareTermsChronologically(a: CanonicalTerm, b: CanonicalTerm): number {
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

export function validateUniqueCanonicalIds(terms: CanonicalTerm[], sourceUrl: string): void {
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
