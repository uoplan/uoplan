import * as cheerio from "cheerio";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import type { Course } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { parseCarletonPrereqs } from "./parsePrereqs.ts";

type CheerioNode = NonNullable<Parameters<cheerio.CheerioAPI>[0]>;

export type CarletonCourseExtras = {
  precludes?: NormalizedCourseCode[];
  contactHours?: string;
  additionalText?: string[];
};

export type ParseSubjectCoursesResult = {
  courses: Course[];
  extras: Map<NormalizedCourseCode, CarletonCourseExtras>;
};

const COURSE_CODE_PATTERN = /\b([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)\b/g;

function normalizeText(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

function extractCodes(text: string): NormalizedCourseCode[] {
  const codes: NormalizedCourseCode[] = [];
  let match: RegExpExecArray | null;
  while ((match = COURSE_CODE_PATTERN.exec(text)) !== null) {
    codes.push(normalizeCourseCode(`${match[1]} ${match[2]}`));
  }
  return Array.from(new Set(codes));
}

function getExtraLines($: cheerio.CheerioAPI, block: CheerioNode): string[] {
  const html = $(block).find(".coursedescadditional").first().html();
  if (!html) return [];
  const withBreaks = html.replaceAll(/<br\s*\/?>/gi, "\n");
  const fragment = cheerio.load(`<div>${withBreaks}</div>`);
  return fragment("div").text().split("\n").map(normalizeText).filter(Boolean);
}

function getDescription($: cheerio.CheerioAPI, block: CheerioNode): string {
  const clone = $(block).clone();
  clone.find("strong, .coursedescadditional").remove();
  return normalizeText(clone.text());
}

function getTitleBlock($: cheerio.CheerioAPI, block: CheerioNode): string {
  const title = $(block).find(".courseblocktitle").first();
  const source = title.length > 0 ? title : $(block).find("strong").first();
  const sourceHtml = source.html();
  if (!sourceHtml) return normalizeText(source.text());
  const withBreaks = sourceHtml.replaceAll(/<br\s*\/?>/gi, " ");
  return normalizeText(cheerio.load(`<div>${withBreaks}</div>`)("div").text());
}

function parseTitle(titleBlock: string): {
  code: NormalizedCourseCode;
  credits: number;
  title: string;
} {
  const match = normalizeText(titleBlock).match(
    /^([A-Z]{3,4}\s*\d{4,5}[A-Z]?)\s+\[(\d+(?:\.\d+)?)\s+credits?\]\s+(.+)$/i,
  );
  if (!match) throw new Error(`Failed to parse Carleton course title: ${titleBlock}`);
  return {
    code: normalizeCourseCode(match[1]),
    credits: Number.parseFloat(match[2]),
    title: normalizeText(match[3]),
  };
}

function parsePrecludes(line: string): NormalizedCourseCode[] {
  const cleaned = line
    .replace(/^Precludes additional credit for\s+/i, "")
    .replace(/^Precludes additional credit for\s+/i, "");
  return extractCodes(cleaned);
}

export function parseSubjectCourses(html: string): ParseSubjectCoursesResult {
  const $ = cheerio.load(html);
  const courses: Course[] = [];
  const extras = new Map<NormalizedCourseCode, CarletonCourseExtras>();

  $(".courseblock").each((_, block) => {
    const titleBlock = getTitleBlock($, block);
    const { code, credits, title } = parseTitle(titleBlock);
    const description = getDescription($, block);
    const extraLines = getExtraLines($, block);
    const aliases: NormalizedCourseCode[] = [];
    const precludes: NormalizedCourseCode[] = [];
    const additionalText: string[] = [];
    let prereqText: string | undefined;
    let contactHours: string | undefined;

    for (const line of extraLines) {
      if (/^Also listed as\b/i.test(line)) {
        aliases.push(...extractCodes(line));
      } else if (/^Prerequisite\(s\):/i.test(line)) {
        prereqText = normalizeText(line.replace(/^Prerequisite\(s\):\s*/i, ""));
      } else if (/^Precludes additional credit for\b/i.test(line)) {
        precludes.push(...parsePrecludes(line));
      } else if (/\b(?:Lectures?|Lecture\/lab|Laborator(?:y|ies)|Tutorials?)\b/i.test(line)) {
        contactHours = contactHours ? `${contactHours} ${line}` : line;
      } else {
        additionalText.push(line);
      }
    }

    const course: Course = {
      code,
      title,
      credits,
      description,
      ...(aliases.length > 0 ? { aliases: Array.from(new Set(aliases)) } : {}),
      ...(prereqText ? { prereqText, prerequisites: parseCarletonPrereqs(prereqText) } : {}),
    };
    courses.push(course);

    const extra: CarletonCourseExtras = {};
    if (precludes.length > 0) extra.precludes = Array.from(new Set(precludes));
    if (contactHours) extra.contactHours = contactHours;
    if (additionalText.length > 0) extra.additionalText = additionalText;
    if (Object.keys(extra).length > 0) extras.set(code, extra);
  });

  return { courses, extras };
}
