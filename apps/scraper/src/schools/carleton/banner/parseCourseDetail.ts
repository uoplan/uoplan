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

export interface CarletonCourseDetail {
  crn: string;
  courseCode: string;
  subject: string;
  catalogNumber: string;
  section: string;
  longTitle: string;
  shortTitle: string;
  description: string;
  credits: number;
  scheduleType: string;
  status: string;
  sectionInformation: string | null;
  restrictions: {
    year: string[];
    level: string[];
    degree: string[];
    major: string[];
    program: string[];
    department: string[];
    faculty: string[];
  };
  meetings: Array<{
    startDate: string | null;
    endDate: string | null;
    days: DayOfWeekCode[];
    startMinutes: number | null;
    endMinutes: number | null;
    schedule: string;
    instructor: string | null;
    primary: boolean;
  }>;
}

type RestrictionKey = keyof CarletonCourseDetail["restrictions"];

const RESTRICTION_LABELS: Record<string, RestrictionKey> = {
  "Degree Restriction": "degree",
  "Department Restriction": "department",
  "Faculty Restriction": "faculty",
  "Level Restriction": "level",
  "Major Restriction": "major",
  "Program Restrictions": "program",
  "Year in Program": "year",
};

function emptyRestrictions(): CarletonCourseDetail["restrictions"] {
  return {
    degree: [],
    department: [],
    faculty: [],
    level: [],
    major: [],
    program: [],
    year: [],
  };
}

function cleanLabel(text: string): string {
  return normalizeSpaces(text).replace(/:$/, "");
}

function addRestriction(
  restrictions: CarletonCourseDetail["restrictions"],
  key: RestrictionKey | null,
  value: string,
): void {
  if (!key) return;
  const normalized = normalizeSpaces(value);
  if (!normalized || normalized === "{None}") return;
  restrictions[key].push(normalized);
}

function parseSubject(value: string): {
  courseCode: string;
  subject: string;
  catalogNumber: string;
  section: string;
} {
  const match = normalizeSpaces(value).match(/^([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)\s+([A-Z0-9]+)$/);
  if (!match) {
    return { courseCode: normalizeCourseCode(value), subject: "", catalogNumber: "", section: "" };
  }
  const courseCode = normalizeCourseCode(`${match[1]} ${match[2]}`);
  return { courseCode, subject: match[1]!, catalogNumber: match[2]!, section: match[3]! };
}

function parseInstructor(text: string): { instructor: string | null; primary: boolean } {
  const normalized = normalizeSpaces(text);
  const primary = /\(Primary\)$/i.test(normalized);
  const instructor = normalized.replace(/\s*\(Primary\)$/i, "").trim() || null;
  return { instructor, primary };
}

function parseMeetings($: cheerio.CheerioAPI): CarletonCourseDetail["meetings"] {
  const meetings: CarletonCourseDetail["meetings"] = [];
  $("table table").each((_, table) => {
    const headers = $(table)
      .find("tr")
      .first()
      .children("td")
      .map((__, cell) => normalizeSpaces($(cell).text()))
      .get();
    if (headers.join("|") !== "Meeting Date|Days|Time|Schedule|Instructor") return;

    $(table)
      .find("tr")
      .slice(1)
      .each((__, row) => {
        const cells = $(row).children("td");
        if (cells.length < 5) return;
        const { startDate, endDate } = parseDateRange(cells.eq(0).text());
        const { startMinutes, endMinutes } = parseTimeRange(cells.eq(2).text());
        const instructor = parseInstructor(cells.eq(4).text());
        meetings.push({
          startDate,
          endDate,
          days: parseDayList(cells.eq(1).text()),
          startMinutes,
          endMinutes,
          schedule: normalizeSpaces(cells.eq(3).text()),
          ...instructor,
        });
      });
  });
  return meetings;
}

export function parseCourseDetail(html: string): CarletonCourseDetail {
  const $ = cheerio.load(html);
  const fields = new Map<string, string>();
  const restrictions = emptyRestrictions();
  let activeRestriction: RestrictionKey | null = null;

  $("section.contentareafull > table > tbody > tr, section.contentareafull > table > tr").each(
    (_, row) => {
      const cells = $(row).children("td");
      if (cells.length < 2) return;
      const label = cleanLabel(cells.eq(0).text());
      const value = htmlToText(cells.eq(1).html());
      const restrictionKey = RESTRICTION_LABELS[label];

      if (restrictionKey) {
        activeRestriction = restrictionKey;
        addRestriction(restrictions, activeRestriction, value);
        return;
      }

      if (!label) {
        addRestriction(restrictions, activeRestriction, value);
        return;
      }

      activeRestriction = null;
      fields.set(label, value);
    },
  );

  const subject = parseSubject(fields.get("Subject") ?? "");

  return {
    crn: fields.get("CRN") ?? "",
    ...subject,
    longTitle: fields.get("Long Title") ?? "",
    shortTitle: fields.get("Title") ?? "",
    description: fields.get("Course Description") ?? "",
    credits: parseCredits(fields.get("Course Credit Value") ?? "0"),
    scheduleType: fields.get("Schedule Type") ?? "",
    status: fields.get("Status") ?? "",
    sectionInformation: fields.get("Section Information") || null,
    restrictions,
    meetings: parseMeetings($),
  };
}
