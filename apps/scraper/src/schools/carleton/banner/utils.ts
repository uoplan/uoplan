import * as cheerio from "cheerio";
import type { DayOfWeekCode } from "@uoplan/domain/dataTypes";
// Deep subpath, not the `dataTypes` barrel: this module is loaded by the
// scraper CLIs, which Node executes directly. The barrel re-exports with
// extensionless relative specifiers that only a bundler can resolve, so
// importing a *value* from it crashes `node src/cli/*.ts` with
// ERR_MODULE_NOT_FOUND. Type-only imports are erased and stay safe either way.
import { DAY_OF_WEEK_CODES } from "@uoplan/domain/dataTypes/domain";

const MONTHS: Record<string, string> = {
  Apr: "04",
  Aug: "08",
  Dec: "12",
  Feb: "02",
  Jan: "01",
  Jul: "07",
  Jun: "06",
  Mar: "03",
  May: "05",
  Nov: "11",
  Oct: "10",
  Sep: "09",
};

const DAY_MAP: Record<string, DayOfWeekCode> = {
  Fri: "Fr",
  Mon: "Mo",
  Sat: "Sa",
  Sun: "Su",
  Thu: "Th",
  Tue: "Tu",
  Wed: "We",
};

export function normalizeSpaces(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html.replaceAll(/<br\s*\/?\s*>/gi, " ");
  return normalizeSpaces(cheerio.load(`<body>${withBreaks}</body>`)("body").text());
}

export function parseCredits(text: string): number {
  const normalized = normalizeSpaces(text);
  if (normalized.startsWith(".")) return Number.parseFloat(`0${normalized}`);
  const value = Number.parseFloat(normalized || "0");
  return Number.isFinite(value) ? value : 0;
}

function parseTimeToMinutes(text: string): number | null {
  const match = normalizeSpaces(text).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseDayList(text: string): DayOfWeekCode[] {
  const days = normalizeSpaces(text)
    .split(" ")
    .map((day) => DAY_MAP[day])
    .filter((day): day is DayOfWeekCode => day != null);
  return days.filter((day) => DAY_OF_WEEK_CODES.includes(day));
}

export function parseDateRange(text: string): { startDate: string | null; endDate: string | null } {
  const match = normalizeSpaces(text).match(
    /([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/,
  );
  if (!match) return { startDate: null, endDate: null };
  const startMonth = MONTHS[match[1]!];
  const endMonth = MONTHS[match[4]!];
  if (!startMonth || !endMonth) return { startDate: null, endDate: null };
  return {
    startDate: `${match[3]}-${startMonth}-${match[2]!.padStart(2, "0")}`,
    endDate: `${match[6]}-${endMonth}-${match[5]!.padStart(2, "0")}`,
  };
}

export function parseTimeRange(text: string): {
  startMinutes: number | null;
  endMinutes: number | null;
} {
  const match = normalizeSpaces(text).match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (!match) return { startMinutes: null, endMinutes: null };
  return {
    startMinutes: parseTimeToMinutes(match[1]!),
    endMinutes: parseTimeToMinutes(match[2]!),
  };
}
