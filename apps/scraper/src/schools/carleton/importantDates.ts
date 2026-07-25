import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import type {
  ImportantDateCategory,
  ImportantDateEffect,
  ImportantDatesData,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { scraperDataDir } from "../../shared/paths.ts";

const ACADEMIC_YEAR_URL = "https://calendar.carleton.ca/academicyear/";

type Season = ImportantDateTerm["season"];
type RawCarletonTerm = {
  label: string;
  sourceId: string;
  season: Season;
  year: number;
  items: Array<{
    dateText: string;
    activity: string;
    interval: { startDate: string; endDate: string } | null;
  }>;
};

const MONTHS: Record<string, number> = {
  April: 4,
  August: 8,
  December: 12,
  February: 2,
  January: 1,
  July: 7,
  June: 6,
  March: 3,
  May: 5,
  November: 11,
  October: 10,
  September: 9,
};

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeText(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

function seasonFromLabel(label: string): Season | null {
  if (/^summer/i.test(label)) return "spring-summer";
  if (/^fall/i.test(label)) return "fall";
  if (/^winter/i.test(label)) return "winter";
  return null;
}

function termInterval(season: Season, year: number): { startDate: string; endDate: string } {
  switch (season) {
    case "spring-summer":
      return { startDate: ymd(year, 5, 1), endDate: ymd(year, 8, 31) };
    case "fall":
      return { startDate: ymd(year, 9, 1), endDate: ymd(year, 12, 31) };
    case "winter":
      return { startDate: ymd(year, 1, 1), endDate: ymd(year, 4, 30) };
  }
}

function termIdFor(season: Season, year: number): string {
  if (season === "winter") return `${year}10`;
  if (season === "spring-summer") return `${year}20`;
  return `${year}30`;
}

function parseDateText(
  text: string,
  fallbackYear: number,
): { startDate: string; endDate: string } | null {
  const normalized = normalizeText(text).replace(/\s+through\s+/i, " to ");
  const range = normalized.match(/^([A-Z][a-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?,\s+(\d{4})$/);
  if (range) {
    const month = MONTHS[range[1]!];
    if (!month) return null;
    const startDay = Number.parseInt(range[2]!, 10);
    const endDay = Number.parseInt(range[3] ?? range[2]!, 10);
    const year = Number.parseInt(range[4]!, 10);
    return { startDate: ymd(year, month, startDay), endDate: ymd(year, month, endDay) };
  }
  const crossMonth = normalized.match(
    /^([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})$/,
  );
  if (crossMonth) {
    const startMonth = MONTHS[crossMonth[1]!];
    const endMonth = MONTHS[crossMonth[4]!];
    if (!startMonth || !endMonth) return null;
    return {
      startDate: ymd(
        Number.parseInt(crossMonth[3]!, 10),
        startMonth,
        Number.parseInt(crossMonth[2]!, 10),
      ),
      endDate: ymd(
        Number.parseInt(crossMonth[6]!, 10),
        endMonth,
        Number.parseInt(crossMonth[5]!, 10),
      ),
    };
  }
  const noYear = normalized.match(/^([A-Z][a-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/);
  if (noYear) {
    const month = MONTHS[noYear[1]!];
    if (!month) return null;
    const startDay = Number.parseInt(noYear[2]!, 10);
    const endDay = Number.parseInt(noYear[3] ?? noYear[2]!, 10);
    return {
      startDate: ymd(fallbackYear, month, startDay),
      endDate: ymd(fallbackYear, month, endDay),
    };
  }
  return null;
}

function classify(activity: string): {
  category: ImportantDateCategory;
  effect: ImportantDateEffect;
} {
  if (/\b(?:statutory holiday|university closed|no classes|break)\b/i.test(activity)) {
    return { category: "breaks", effect: "no_classes" };
  }
  if (/\b(?:examinations?|exams?|grades?|tests?)\b/i.test(activity)) {
    return { category: "grades_exams", effect: "deadline" };
  }
  if (/\b(?:tuition|fee|payment|late charge)\b/i.test(activity)) {
    return { category: "tuition", effect: "deadline" };
  }
  if (
    /\b(?:registration|course changes?|withdraw|applications?|admission|degree program transfer)\b/i.test(
      activity,
    )
  ) {
    return { category: "enrolment", effect: "deadline" };
  }
  if (/\bclasses follow\b/i.test(activity)) {
    return { category: "schedule_changes", effect: "informational" };
  }
  return { category: "other", effect: "informational" };
}

function sectionLabel(category: ImportantDateCategory): string {
  switch (category) {
    case "overview":
      return "Overview";
    case "breaks":
      return "Statutory holidays, breaks and special events";
    case "schedule_changes":
      return "Schedule changes";
    case "enrolment":
      return "Registration, enrolment and withdrawal";
    case "grades_exams":
      return "Grades and examinations";
    case "tuition":
      return "Tuition and fees";
    default:
      return "Other academic dates";
  }
}

export function buildFrenchFallbackImportantDates(en: ImportantDatesData): ImportantDatesData {
  return { ...en, locale: "fr-CA" };
}

export function parseCarletonImportantDates(
  html: string,
  sourceUrl = ACADEMIC_YEAR_URL,
): ImportantDatesData {
  const $ = cheerio.load(html);
  const rawTerms: RawCarletonTerm[] = [];
  let current: RawCarletonTerm | null = null;
  let lastDateText = "";

  $("tr").each((_, row) => {
    const cells = $(row).children("td, th");
    const first = normalizeText(cells.eq(0).text());
    const second = normalizeText(cells.eq(1).text());
    const heading = first.match(/^(SUMMER|FALL|WINTER)\s+TERM\s+(\d{4})$/i);
    if (heading) {
      const season = seasonFromLabel(heading[1]!);
      if (!season) return;
      const year = Number.parseInt(heading[2]!, 10);
      current = {
        label: `${heading[1]![0]!.toUpperCase()}${heading[1]!.slice(1).toLowerCase()} ${year}`,
        sourceId: `carleton-${season}-${year}`,
        season,
        year,
        items: [],
      };
      rawTerms.push(current);
      lastDateText = "";
      return;
    }
    if (!current || (!first && !second)) return;
    const dateText = first || lastDateText;
    if (!dateText || !second) return;
    lastDateText = dateText;
    current.items.push({
      dateText,
      activity: second,
      interval: parseDateText(dateText, current.year),
    });
  });

  const builtTerms = rawTerms.map((raw) => {
    const baseInterval = termInterval(raw.season, raw.year);
    const classStarts = raw.items
      .filter((item) => /\bclasses?\s+begin\b/i.test(item.activity) && item.interval)
      .map((item) => item.interval!.startDate)
      .sort();
    const classEnds = raw.items
      .filter(
        (item) =>
          /\b(?:last day of .*classes|classes end|term ends)\b/i.test(item.activity) &&
          item.interval,
      )
      .map((item) => item.interval!.endDate)
      .sort();
    const courseInterval = {
      startDate: classStarts[0] ?? baseInterval.startDate,
      endDate: classEnds.at(-1) ?? baseInterval.endDate,
    };
    const sections = new Map<ImportantDateCategory, ImportantDateTerm["sections"][number]>();
    const ensureSection = (
      category: ImportantDateCategory,
    ): ImportantDateTerm["sections"][number] => {
      const existing = sections.get(category);
      if (existing) return existing;
      const section = {
        id: `${raw.sourceId}:${category}`,
        label: sectionLabel(category),
        category,
        groups: [{ id: `${raw.sourceId}:${category}:g0`, items: [] }],
      };
      sections.set(category, section);
      return section;
    };

    ensureSection("overview").groups[0]!.items.push(
      {
        id: `${raw.sourceId}:overview:g0:r0`,
        topic: "Term dates",
        dateText: `${baseInterval.startDate} to ${baseInterval.endDate}`,
        effect: "structural",
        interval: baseInterval,
      },
      {
        id: `${raw.sourceId}:overview:g0:r1`,
        topic: "Course dates",
        dateText: `${courseInterval.startDate} to ${courseInterval.endDate}`,
        effect: "structural",
        interval: courseInterval,
      },
    );

    for (const item of raw.items) {
      const { category, effect } = classify(item.activity);
      const section = ensureSection(category);
      const items = section.groups[0]!.items;
      items.push({
        id: `${raw.sourceId}:${category}:g0:r${items.length}`,
        topic: item.activity,
        dateText: item.dateText,
        effect,
        ...(item.interval ? { interval: item.interval } : {}),
      });
    }

    return {
      sourceId: raw.sourceId,
      termId: termIdFor(raw.season, raw.year),
      label: raw.label,
      season: raw.season,
      year: raw.year,
      sourcePublished: "true",
      termInterval: baseInterval,
      courseInterval,
      sections: [...sections.values()],
      sessions: [],
    } satisfies ImportantDateTerm;
  });

  return { locale: "en", sourceUrl, terms: builtTerms };
}

async function scrapeCarletonImportantDates(): Promise<{
  en: ImportantDatesData;
  fr: ImportantDatesData;
}> {
  const response = await fetch(ACADEMIC_YEAR_URL, {
    headers: { "User-Agent": "uoplan-scraper/1.0 (+https://uoplan.party; Carleton CourseLeaf)" },
  });
  if (!response.ok)
    throw new Error(`Failed to fetch ${ACADEMIC_YEAR_URL}: HTTP ${response.status}`);
  const en = parseCarletonImportantDates(await response.text(), ACADEMIC_YEAR_URL);
  // Carleton publishes this page in English only; use identical prose in fr-CA so
  // consumers can load the existing locale-specific asset path without special cases.
  return { en, fr: buildFrenchFallbackImportantDates(en) };
}

export async function writeCarletonImportantDates(): Promise<{
  en: ImportantDatesData;
  fr: ImportantDatesData;
}> {
  const result = await scrapeCarletonImportantDates();
  const dataDir = scraperDataDir("carleton");
  await fs.mkdir(dataDir, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(dataDir, "important-dates.en.json"),
      `${JSON.stringify(result.en, null, 2)}\n`,
      "utf-8",
    ),
    fs.writeFile(
      path.join(dataDir, "important-dates.fr.json"),
      `${JSON.stringify(result.fr, null, 2)}\n`,
      "utf-8",
    ),
  ]);
  return result;
}
