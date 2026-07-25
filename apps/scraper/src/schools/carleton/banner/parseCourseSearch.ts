import * as cheerio from "cheerio";
import type { DayOfWeekCode } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import {
  htmlToText,
  normalizeSpaces,
  parseCredits,
  parseDateRange,
  parseDayList,
  parseTimeRange,
} from "./utils.ts";

export interface CarletonLinkedGroup {
  /** Alternatives within one required component — satisfy any ONE. */
  alternatives: Array<{ courseCode: string; section: string }>;
}

export interface CarletonSection {
  crn: string;
  courseCode: string;
  subject: string;
  catalogNumber: string;
  section: string;
  title: string;
  credits: number;
  scheduleType: string;
  status: string;
  instructor: string | null;
  meetings: Array<{
    days: DayOfWeekCode[];
    startMinutes: number | null;
    endMinutes: number | null;
    startDate: string | null;
    endDate: string | null;
  }>;
  /** Each group is a separate REQUIRED component; satisfy one alternative from each. */
  linkedGroups: CarletonLinkedGroup[];
  sectionInformation: string | null;
  /** Parsed out of sectionInformation. */
  virtual: boolean;
  detailUrl: string | null;
}

type CourseParts = { courseCode: string; subject: string; catalogNumber: string };

function parseCourseParts(raw: string): CourseParts | null {
  const normalized = normalizeCourseCode(raw);
  const match = normalized.match(/^([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)$/);
  if (!match) return null;
  return { courseCode: normalized, subject: match[1]!, catalogNumber: match[2]! };
}

function parseMeetingDetail(text: string): CarletonSection["meetings"][number] | null {
  const normalized = normalizeSpaces(text);
  const match = normalized.match(/Meeting Date:\s*(.*?)\s*Days:\s*(.*?)\s*Time:\s*(.*)$/i);
  if (!match) return null;
  const { startDate, endDate } = parseDateRange(match[1]!);
  const { startMinutes, endMinutes } = parseTimeRange(match[3]!);
  return {
    days: parseDayList(match[2]!),
    startMinutes,
    endMinutes,
    startDate,
    endDate,
  };
}

function isVirtualSection(sectionInformation: string | null): boolean {
  if (!sectionInformation) return false;
  const upper = sectionInformation.toUpperCase();
  return upper.includes("ONLINE") || upper.includes("CAMPUS PRESENCE IS NOT REQUIRED");
}

function detailText($: cheerio.CheerioAPI, row: Parameters<cheerio.CheerioAPI>[0]): string {
  const detailCell = $(row).children("td").eq(1);
  return htmlToText(detailCell.html());
}

export function parseAlsoRegisterIn(text: string): CarletonLinkedGroup[] {
  const groups: CarletonLinkedGroup[] = [];
  let currentCourseCode: string | null = null;

  for (const groupText of normalizeSpaces(text).split(/\s+and\s+/i)) {
    const alternatives: CarletonLinkedGroup["alternatives"] = [];
    for (const token of groupText.split(/\s+or\s+/i)) {
      const normalized = normalizeSpaces(token);
      if (!normalized) continue;
      const fullMatch = normalized.match(/^([A-Z]{3,4}\s*\d{4,5}[A-Z]?)\s+([A-Z0-9]+)$/i);
      if (fullMatch) {
        currentCourseCode = normalizeCourseCode(fullMatch[1]!);
        alternatives.push({ courseCode: currentCourseCode, section: fullMatch[2]!.toUpperCase() });
        continue;
      }
      if (currentCourseCode) {
        alternatives.push({ courseCode: currentCourseCode, section: normalized.toUpperCase() });
      }
    }
    if (alternatives.length > 0) groups.push({ alternatives });
  }

  return groups;
}

export function parseCourseSearch(html: string): CarletonSection[] {
  const $ = cheerio.load(html);
  const sections: CarletonSection[] = [];
  let current: CarletonSection | null = null;

  $("tr[bgcolor]").each((_, row) => {
    const cells = $(row).children("td");
    const crn = normalizeSpaces(cells.eq(2).text());

    if (/^\d{5}$/.test(crn)) {
      const parsed = parseCourseParts(cells.eq(3).text());
      if (!parsed) {
        current = null;
        return;
      }
      const instructor = normalizeSpaces(cells.eq(10).text()) || null;
      current = {
        crn,
        ...parsed,
        section: normalizeSpaces(cells.eq(4).text()),
        title: normalizeSpaces(cells.eq(5).text()),
        credits: parseCredits(cells.eq(6).text()),
        scheduleType: normalizeSpaces(cells.eq(7).text()),
        status: normalizeSpaces(cells.eq(1).text()),
        instructor,
        meetings: [],
        linkedGroups: [],
        sectionInformation: null,
        virtual: false,
        detailUrl: cells.eq(2).find("a").attr("href")?.trim() ?? null,
      };
      sections.push(current);
      return;
    }

    if (!current) return;
    const text = detailText($, row);
    if (!text) return;

    if (/^Meeting Date:/i.test(text)) {
      const meeting = parseMeetingDetail(text);
      if (meeting) current.meetings.push(meeting);
      return;
    }

    if (/^Also Register in:/i.test(text)) {
      current.linkedGroups = parseAlsoRegisterIn(text.replace(/^Also Register in:\s*/i, ""));
      return;
    }

    if (/^Section Information:/i.test(text)) {
      current.sectionInformation =
        normalizeSpaces(text.replace(/^Section Information:\s*/i, "")) || null;
      current.virtual = isVirtualSection(current.sectionInformation);
    }
  });

  return sections;
}
