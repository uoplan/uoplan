import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import type { Got } from "got";
import { SCRAPER_DATA_DIR } from "../shared/paths.ts";
import { getErrorMessage } from "../shared/errors.ts";
import { bootstrapPeopleSoft, PEOPLESOFT_CLASS_SEARCH_URL } from "../shared/peoplesoft.ts";
import {
  buildGradeLookups,
  enrichSchedulesPayload,
  formatGradeEnrichmentLine,
  type GradeLookups,
} from "./enrich.ts";

const BASE_URL = PEOPLESOFT_CLASS_SEARCH_URL;
const HTML_CACHE_DIR = ".cache/course-search-html";
const MAX_CONCURRENCY = 50;
const USE_CACHE_ONLY = process.argv.includes("use-cache");
const WRITE_CACHE = process.argv.includes("write-cache");

type Term = { termId: string; name: string };

interface CatalogueCourse {
  code: string;
}

interface ParsedCourseCode {
  subject: string;
  catalogNbr: string;
  code: string;
}

type DayOfWeek = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

interface MeetingTime {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  virtual: boolean;
  instructor: string | null;
  meetingDates: MeetingDateRange | null;
}

type MeetingDateRange = [string, string];

interface ComponentSection {
  section: string;
  sectionCode: string | null;
  component: string | null;
  session: string | null;
  times: MeetingTime[];
  status: string | null;
  /** Filled by grade enrichment from `grades.json` when present. */
  distribution?: Record<string, number>;
}

interface CourseSchedule {
  subject: string;
  catalogNumber: string;
  courseCode: string;
  title: string | null;
  timeZone: string;
  components: Record<string, ComponentSection[]>;
}

interface ClientInfo {
  client: Got;
  icsid: string;
  dataLang: string;
  icStateNum: string;
}

const DAY_MAP: Record<string, DayOfWeek> = {
  Mo: "Mo",
  Mon: "Mo",
  Tu: "Tu",
  Tue: "Tu",
  We: "We",
  Wed: "We",
  Th: "Th",
  Thu: "Th",
  Fr: "Fr",
  Fri: "Fr",
  Sa: "Sa",
  Sat: "Sa",
  Su: "Su",
  Sun: "Su",
};

function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function parseMeetingDates(text: string): MeetingDateRange | null {
  const m = text.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  // Store as local ET dates (no offset) so consumers can combine with times using the ET timezone.
  const startDate = m[1];
  const endDate = m[2];
  if (
    Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`))
  ) {
    return null;
  }
  return [startDate, endDate];
}

function parseSectionHeader(raw: string): {
  sectionCode: string | null;
  component: string | null;
  session: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { sectionCode: null, component: null, session: null };

  // Expect something like "F00-LEC FullSess."
  const m = trimmed.match(/^([A-Za-z0-9]+)-([A-Z]+)\s*(.*)$/);
  if (!m) {
    return { sectionCode: null, component: null, session: trimmed || null };
  }
  const sectionCode = m[1] || null;
  const component = m[2] || null;
  const session = m[3] ? m[3].trim() || null : null;
  return { sectionCode, component, session };
}

function parseCourseCode(code: string): ParsedCourseCode | null {
  const m = code.match(/^([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)/);
  if (!m) return null;
  return { subject: m[1], catalogNbr: m[2], code: `${m[1]} ${m[2]}` };
}

function getCatalogueYearForTerm(termName: string): number {
  const m = termName.match(/(\d{4})/);
  if (!m) throw new Error(`Cannot extract year from term name: ${termName}`);
  const year = parseInt(m[1], 10);
  return termName.toLowerCase().includes("fall") ? year : year - 1;
}

async function loadCatalogue(year: number): Promise<ParsedCourseCode[]> {
  const raw = await fs.readFile(path.join(SCRAPER_DATA_DIR, `catalogue.${year}.json`), "utf-8");
  const data = JSON.parse(raw) as { courses?: CatalogueCourse[] };
  if (!Array.isArray(data.courses)) {
    throw new Error("catalogue.json does not contain a courses array");
  }

  //const mat1300 = data.courses.find(c => c.code === 'MAT 1300');

  /*data.courses = data.courses.slice(0, 100);
  if (!data.courses.includes(mat1300!)) {
    data.courses.push(mat1300!);
  }*/

  const unique = new Map<string, ParsedCourseCode>();
  for (const course of data.courses) {
    if (!course || typeof course.code !== "string") continue;
    const parsed = parseCourseCode(course.code);
    if (!parsed) continue;
    const key = parsed.code;
    if (!unique.has(key)) {
      unique.set(key, parsed);
    }
  }

  return Array.from(unique.values());
}

async function createClient(): Promise<ClientInfo> {
  const { value } = await bootstrapPeopleSoft(
    BASE_URL,
    (html, client) => {
      const $ = cheerio.load(html);
      const icsid = $("#ICSID").attr("value");
      if (!icsid) return null;
      const icStateNum = $("#ICStateNum").attr("value") || "1";
      const dataLang = ($("#\\#ICDataLang").val() as string | undefined) || "ENG";
      return { client, icsid, dataLang, icStateNum };
    },
    (preview) =>
      new Error(`Failed to find ICSID on initial class search page; first 400 chars: ${preview}`),
  );
  return value;
}
type YearOfStudy = 1 | 2 | 3 | 4 | "grad";

function buildSearchBody(args: {
  icsid: string;
  dataLang: string;
  icStateNum: string;
  subject: string;
  catalogNbr?: string;
  termId?: string;
  virtual?: boolean;
  yearOfStudy?: YearOfStudy;
}): string {
  const { icsid, dataLang, icStateNum, subject, catalogNbr, termId, virtual, yearOfStudy } = args;

  const params = new URLSearchParams();

  // Core PeopleSoft navigation / panel fields (non-AJAX, full page response)
  params.set("ICType", "Panel");
  params.set("ICElementNum", "0");
  params.set("ICStateNum", icStateNum);
  params.set("ICAction", "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
  params.set("ICModelCancel", "0");
  params.set("ICXPos", "0");
  params.set("ICYPos", "0");
  params.set("ResponsetoDiffFrame", "-1");
  params.set("TargetFrameName", "None");
  params.set("FacetPath", "None");
  params.set("PrmtTbl", "");
  params.set("PrmtTbl_fn", "");
  params.set("PrmtTbl_fv", "");
  params.set("TA_SkipFldNms", "");
  params.set("ICFocus", "");
  params.set("ICSaveWarningFilter", "0");
  params.set("ICChanged", "-1");
  params.set("ICSkipPending", "0");
  params.set("ICAutoSave", "0");
  params.set("ICResubmit", "0");
  params.set("ICSID", icsid);
  params.set("ICActionPrompt", "false");
  params.set("ICTypeAheadID", "");
  params.set("ICBcDomData", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");

  // Language / term
  params.set("#ICDataLang", dataLang || "ENG");
  if (termId) {
    params.set("CLASS_SRCH_WRK2_STRM$35$", termId);
  }

  // Course criteria. An empty catalog number performs a subject-only search (many courses).
  params.set("SSR_CLSRCH_WRK_SUBJECT$0", subject);
  params.set("SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$0", "E"); // course number "exact match"
  params.set("SSR_CLSRCH_WRK_CATALOG_NBR$0", catalogNbr ?? "");

  // Keep other fields in a neutral state to mimic the real form as closely as possible.
  params.set("SSR_CLSRCH_WRK_ACAD_CAREER$0", "");
  // Open only flag unchecked (send both variants as "N"/empty)
  params.set("SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$0", "N");
  params.set("SSR_CLSRCH_WRK_SSR_OPEN_ONLY$0", "N");
  params.set("UO_PUB_SRCH_WRK_ACAD_GROUP$0", "");
  params.set("SSR_CLSRCH_WRK_DESCR$0", "");
  params.set("UO_PUB_SRCH_WRK_UO_LNG_FR$chk$0", "N");
  params.set("UO_PUB_SRCH_WRK_UO_LNG_EN$chk$0", "N");
  params.set("UO_PUB_SRCH_WRK_UO_LNG_OT$chk$0", "N");
  params.set("UO_PUB_SRCH_WRK_UO_LNG_BI$chk$0", "N");
  // Year-of-study facet. Selecting a single value narrows an otherwise-overflowing subject search.
  for (const opt of ["01", "02", "03", "04"] as const) {
    const on = yearOfStudy === Number(opt);
    params.set(`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_${opt}$chk$0`, on ? "Y" : "N");
    if (on) params.set(`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_${opt}$0`, "Y");
  }
  const gradOn = yearOfStudy === "grad";
  params.set("UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$chk$0", gradOn ? "Y" : "N");
  if (gradOn) params.set("UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$0", "Y");
  params.set("SSR_CLSRCH_WRK_SSR_START_TIME_OPR$0", "GE");
  params.set("SSR_CLSRCH_WRK_MEETING_TIME_START$0", "");
  params.set("SSR_CLSRCH_WRK_SSR_END_TIME_OPR$0", "LE");
  params.set("SSR_CLSRCH_WRK_MEETING_TIME_END$0", "");
  params.set("SSR_CLSRCH_WRK_INCLUDE_CLASS_DAYS$0", "I");
  params.set("SSR_CLSRCH_WRK_MON$chk$0", "");
  params.set("SSR_CLSRCH_WRK_TUES$chk$0", "");
  params.set("SSR_CLSRCH_WRK_WED$chk$0", "");
  params.set("SSR_CLSRCH_WRK_THURS$chk$0", "");
  params.set("SSR_CLSRCH_WRK_FRI$chk$0", "");
  params.set("SSR_CLSRCH_WRK_SAT$chk$0", "");
  params.set("SSR_CLSRCH_WRK_SUN$chk$0", "");
  params.set("SSR_CLSRCH_WRK_SSR_EXACT_MATCH2$0", "B");
  params.set("SSR_CLSRCH_WRK_LAST_NAME$0", "");
  params.set("SSR_CLSRCH_WRK_SSR_COMPONENT$0", "");
  params.set("SSR_CLSRCH_WRK_SESSION_CODE$0", "");
  params.set("SSR_CLSRCH_WRK_INSTRUCTION_MODE$0", "");
  params.set("SSR_CLSRCH_WRK_LOCATION$0", virtual ? "ZZVIRTL" : "");
  params.set("UO_PUB_SRCH_WRK_UO_ONLINE_COURSES$chk$0", "N");
  params.set("UO_PUB_SRCH_WRK_UO_AUDITOR_PERMITD$chk$0", "N");
  params.set("UO_PUB_SRCH_WRK_UO_UOTTA_CARLETON$chk$0", "N");

  return params.toString();
}

const YEAR_SLICES: YearOfStudy[] = [1, 2, 3, 4, "grad"];

type BannerKind = "none" | "empty" | "overflow";

/** Classify the PeopleSoft response banner before attempting to parse results. */
function classifyBanner(html: string): BannerKind {
  const text = cheerio
    .load(html)("span.PSERRORTEXT, div.PSERRORTEXT, span.SSSMSGALERTTEXT")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return "none";
  if (text.includes("maximum limit") || text.includes("exceed")) return "overflow";
  if (text.includes("no classes") || text.includes("no results")) return "empty";
  return "none";
}

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioSelection = ReturnType<CheerioRoot>;

/** Parse a single meeting/section row into a component-keyed section, or null if the row is empty. */
function parseSectionRow(
  $row: CheerioSelection,
  virtual: boolean,
): { compKey: string; section: ComponentSection } | null {
  const sectionSpan = $row.find('span[id^="MTG_CLASSNAME$"]').first();
  const sectionHtml = sectionSpan.html() || "";
  const sectionLines = sectionHtml
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const rawSection = sectionLines.join(" ");

  const daysSpan = $row.find('span#MTG_DAYTIME\\$0, span[id^="MTG_DAYTIME$"]').first();
  const daysHtml = daysSpan.html() || "";
  const dayLines = daysHtml
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const instrSpan = $row.find('span#MTG_INSTR\\$0, span[id^="MTG_INSTR$"]').first();
  const instrHtml = instrSpan.html() || "";
  const instructorParts = instrHtml
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const datesSpan = $row.find('span#MTG_TOPIC\\$0, span[id^="MTG_TOPIC$"]').first();
  const datesHtml = datesSpan.html() || "";
  const dateLines = datesHtml
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const statusAlt =
    $row.find('div[id^="win0divDERIVED_CLSRCH_SSR_STATUS_LONG$"] img').attr("alt") || null;

  if (
    !rawSection &&
    dayLines.length === 0 &&
    instructorParts.length === 0 &&
    dateLines.length === 0 &&
    !statusAlt
  ) {
    return null;
  }

  const { sectionCode, component, session } = parseSectionHeader(sectionLines[0] || rawSection);

  const times: MeetingTime[] = [];
  for (let i = 0; i < dayLines.length; i++) {
    const line = dayLines[i];
    const m = line.match(/^([A-Za-z]{2,3})\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const dayKey = DAY_MAP[m[1]];
    if (!dayKey) continue;
    const start = parseTimeToMinutes(m[2]);
    const end = parseTimeToMinutes(m[3]);
    if (start == null || end == null) continue;
    times.push({
      day: dayKey,
      startMinutes: start,
      endMinutes: end,
      virtual,
      instructor: instructorParts[i] ?? null,
      meetingDates: dateLines[i] ? parseMeetingDates(dateLines[i]) : null,
    });
  }

  const compKey = component || "UNKNOWN";
  const section: ComponentSection = {
    section: rawSection || sectionLines[0] || "",
    sectionCode,
    component,
    session,
    times,
    status: statusAlt,
  };

  return { compKey, section };
}

/** Build a component map from a set of meeting tables belonging to one course. */
function parseTablesIntoComponents(
  $: CheerioRoot,
  tables: CheerioSelection[],
  virtual: boolean,
): Record<string, ComponentSection[]> {
  const components: Record<string, ComponentSection[]> = {};
  for (const table of tables) {
    table.find('tr[id^="trSSR_CLSRCH_MTG1"]').each((_, row) => {
      const parsed = parseSectionRow($(row), virtual);
      if (!parsed) return;
      if (!components[parsed.compKey]) components[parsed.compKey] = [];
      components[parsed.compKey].push(parsed.section);
    });
  }
  return components;
}

/** Extract subject / catalog number / title from a course groupbox anchor title. */
function parseCourseAnchorTitle(
  title: string,
): { subject: string; catalogNbr: string; title: string | null } | null {
  // e.g. "Collapse section ITI 1120 - Introduction to Computing I"
  const m = title.match(/([A-Z]{3,4})\s+(\d{4,5}[A-Z]?)\s*-\s*(.+)$/);
  if (!m) return null;
  return { subject: m[1], catalogNbr: m[2], title: m[3].trim() || null };
}

/**
 * Parse a PeopleSoft class-search response that may contain MANY courses (subject-level search).
 * Course groupbox anchors and their meeting tables are flat siblings, so tables are associated with
 * the most recent preceding course anchor in document order.
 */
export function parseSearchResultsHtml(html: string, virtual: boolean = false): CourseSchedule[] {
  const $ = cheerio.load(html);

  type Group = {
    subject: string;
    catalogNbr: string;
    title: string | null;
    tables: CheerioSelection[];
  };
  const groups: Group[] = [];
  let current: Group | null = null;
  let orphanTables = 0;

  // A comma selector yields matches in document order, letting us walk anchors and tables together.
  $('a[id^="SSR_CLSRSLT_WRK_GROUPBOX2$"], table[id^="SSR_CLSRCH_MTG1$scroll$"]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id") || "";
    if (id.startsWith("SSR_CLSRSLT_WRK_GROUPBOX2$")) {
      const rawTitle = $el.attr("title") ?? "";
      const parsed = parseCourseAnchorTitle(rawTitle);
      if (!parsed) {
        console.error(`Could not parse course anchor title: "${rawTitle}". Skipping its sections.`);
        current = null;
        return;
      }
      current = { ...parsed, tables: [] };
      groups.push(current);
    } else {
      // A meeting table.
      if (!current) {
        orphanTables += 1;
        return;
      }
      current.tables.push($el);
    }
  });

  if (orphanTables > 0) {
    console.error(
      `${orphanTables} meeting table(s) appeared before any course header and were ignored.`,
    );
  }

  const schedules: CourseSchedule[] = [];
  for (const group of groups) {
    const components = parseTablesIntoComponents($, group.tables, virtual);
    const totalSections = Object.values(components).reduce((sum, arr) => sum + arr.length, 0);
    if (totalSections === 0) continue;
    schedules.push({
      subject: group.subject,
      catalogNumber: group.catalogNbr,
      courseCode: `${group.subject} ${group.catalogNbr}`,
      title: group.title,
      timeZone: "America/Toronto",
      components,
    });
  }

  return schedules;
}

function timeKey(t: MeetingTime): string {
  return `${t.day}|${t.startMinutes}|${t.endMinutes}`;
}

function sectionKey(componentKey: string, section: ComponentSection): string {
  return `${componentKey}|${section.sectionCode ?? ""}|${section.section}`;
}

function mergeVirtualIntoBase(base: CourseSchedule, virtualOnly: CourseSchedule): CourseSchedule {
  // base is treated as "non-virtual"; this function flips the relevant meeting-times to virtual.
  for (const [compKey, vSections] of Object.entries(virtualOnly.components)) {
    if (!base.components[compKey]) base.components[compKey] = [];
    const baseSections = base.components[compKey];

    const baseSectionByKey = new Map<string, ComponentSection>();
    baseSections.forEach((s) => baseSectionByKey.set(sectionKey(compKey, s), s));

    for (const vSection of vSections) {
      const key = sectionKey(compKey, vSection);
      const baseSection = baseSectionByKey.get(key);

      if (!baseSection) {
        // Extremely defensive: if a virtual section doesn't exist in the base result, keep it.
        baseSections.push(vSection);
        baseSectionByKey.set(key, vSection);
        continue;
      }

      const baseTimeByKey = new Map<string, number>();
      baseSection.times.forEach((t, idx) => baseTimeByKey.set(timeKey(t), idx));

      for (const vt of vSection.times) {
        const tKey = timeKey(vt);
        const baseTimeIdx = baseTimeByKey.get(tKey);
        if (baseTimeIdx != null) {
          baseSection.times[baseTimeIdx].virtual = true;
        } else {
          baseSection.times.push(vt);
          baseTimeByKey.set(tKey, baseSection.times.length - 1);
        }
      }
    }
  }

  return base;
}

/** Merge `src` course sections into `target` (same courseCode), deduping sections and times. */
function mergeCourseInto(target: CourseSchedule, src: CourseSchedule): void {
  if (!target.title && src.title) target.title = src.title;
  for (const [compKey, srcSections] of Object.entries(src.components)) {
    if (!target.components[compKey]) target.components[compKey] = [];
    const targetSections = target.components[compKey];
    const byKey = new Map<string, ComponentSection>();
    targetSections.forEach((s) => byKey.set(sectionKey(compKey, s), s));
    for (const srcSection of srcSections) {
      const key = sectionKey(compKey, srcSection);
      const existing = byKey.get(key);
      if (!existing) {
        targetSections.push(srcSection);
        byKey.set(key, srcSection);
        continue;
      }
      const timeKeys = new Set(existing.times.map(timeKey));
      for (const t of srcSection.times) {
        if (!timeKeys.has(timeKey(t))) {
          existing.times.push(t);
          timeKeys.add(timeKey(t));
        }
      }
    }
  }
}

/** Union a list of course schedules by course code, deduping sections/times. Preserves order. */
function unionSchedulesByCourse(lists: CourseSchedule[][]): CourseSchedule[] {
  const byCode = new Map<string, CourseSchedule>();
  for (const list of lists) {
    for (const schedule of list) {
      const existing = byCode.get(schedule.courseCode);
      if (!existing) {
        byCode.set(schedule.courseCode, schedule);
      } else {
        mergeCourseInto(existing, schedule);
      }
    }
  }
  return Array.from(byCode.values());
}

/**
 * Execute a single class-search POST and return its banner classification + raw HTML.
 * Handles session-state refresh and login/redirect retries. Returns null only if a usable response
 * could not be obtained (login wall) after retries.
 */
async function performSearch(
  clientInfo: ClientInfo,
  termId: string,
  sp: { subject: string; catalogNbr?: string; yearOfStudy?: YearOfStudy; virtual: boolean },
  cacheLabel: string,
): Promise<{ banner: BannerKind; html: string }> {
  const { dataLang } = clientInfo;
  const safeSubject = sp.subject.replace(/[^A-Za-z0-9]+/g, "_");
  const cacheFilename = `${safeSubject}-${cacheLabel}-${termId}-${sp.virtual ? "virtual" : "nonvirtual"}.html`;
  const cachePath = path.join(HTML_CACHE_DIR, cacheFilename);
  const label =
    `${sp.subject}${sp.catalogNbr ? ` ${sp.catalogNbr}` : ""}` +
    `${sp.yearOfStudy ? ` [y${sp.yearOfStudy}]` : ""}${sp.virtual ? " (virtual)" : ""}`;

  if (USE_CACHE_ONLY) {
    try {
      const cachedHtml = await fs.readFile(cachePath, "utf-8");
      return { banner: classifyBanner(cachedHtml), html: cachedHtml };
    } catch (err: unknown) {
      console.error(
        `Cache miss for ${label} with use-cache enabled (expected ${cachePath}):`,
        getErrorMessage(err),
      );
      return { banner: "empty", html: "" };
    }
  }

  for (let attempt = 1; attempt <= 10; attempt++) {
    // Refresh page-level state (ICSID / ICStateNum) from a fresh criteria page load.
    const initRes = await clientInfo.client.get(BASE_URL);
    try {
      const $init = cheerio.load(initRes.body);
      const pageIcsid = $init("#ICSID").attr("value");
      if (pageIcsid) clientInfo.icsid = pageIcsid;
      const pageState = $init("#ICStateNum").attr("value");
      if (pageState) clientInfo.icStateNum = pageState;
    } catch {
      // Ignore and fall back to previously known state.
    }

    const body = buildSearchBody({
      icsid: clientInfo.icsid,
      dataLang,
      icStateNum: clientInfo.icStateNum,
      subject: sp.subject,
      catalogNbr: sp.catalogNbr,
      termId,
      virtual: sp.virtual,
      yearOfStudy: sp.yearOfStudy,
    });

    const res = await clientInfo.client.post(BASE_URL, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    // Update session state from the response for subsequent requests.
    try {
      const $ = cheerio.load(res.body);
      const newIcsid = $("#ICSID").attr("value");
      if (newIcsid) clientInfo.icsid = newIcsid;
      const newStateNum = $("#ICStateNum").attr("value");
      if (newStateNum) clientInfo.icStateNum = newStateNum;
    } catch {
      // Non-fatal; fall back to previous state values.
    }

    try {
      await fs.mkdir(HTML_CACHE_DIR, { recursive: true });
      if (WRITE_CACHE) await fs.writeFile(cachePath, res.body, "utf-8");
    } catch (err: unknown) {
      console.error(`Warning: failed to write HTML cache for ${label}:`, getErrorMessage(err));
    }

    // Detect login / redirect pages (not real search or results pages).
    const lowerHtml = res.body.toLowerCase();
    const looksLikeLogin =
      lowerHtml.includes("sign in to peoplesoft") ||
      lowerHtml.includes("you must have cookies enabled") ||
      (/<meta[^>]+http-equiv=['"]refresh['"]/i.test(res.body) && res.body.includes("CAMPUS_URL="));
    if (looksLikeLogin) {
      console.error(
        `Received login/redirect page instead of search results for ${label}. ` +
          `See cached HTML at ${cachePath}. Will retry with new session (attempt ${attempt}/10).`,
      );
      if (attempt < 10) {
        const newSession = await createClient();
        Object.assign(clientInfo, newSession);
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return { banner: "empty", html: res.body };
    }

    const banner = classifyBanner(res.body);
    if (banner !== "none") {
      // "overflow" and "empty" are terminal states; no retry needed.
      return { banner, html: res.body };
    }

    // No banner: a real results page should contain at least one course header. If not, the page
    // may not have rendered yet (transient) — retry as the old per-course path did.
    const hasResults = res.body.includes("SSR_CLSRSLT_WRK_GROUPBOX2$");
    if (hasResults) {
      return { banner: "none", html: res.body };
    }

    if (attempt < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.error(
    `Failed to obtain class-search results for ${label} after 10 attempts. See ${cachePath}`,
  );
  process.exit(1);
}

/** One subject+facet search returning parsed courses, or "overflow" when the 300-section cap hits. */
async function fetchSubjectSlice(
  clientInfo: ClientInfo,
  termId: string,
  subject: string,
  virtual: boolean,
  yearOfStudy: YearOfStudy | undefined,
  cacheLabel: string,
): Promise<CourseSchedule[] | "overflow"> {
  const { banner, html } = await performSearch(
    clientInfo,
    termId,
    { subject, virtual, yearOfStudy },
    cacheLabel,
  );
  if (banner === "overflow") return "overflow";
  if (banner === "empty") return [];
  return parseSearchResultsHtml(html, virtual);
}

/** Exact single-course search (per-course fallback for slices that still overflow). */
async function fetchCourseExact(
  clientInfo: ClientInfo,
  termId: string,
  course: ParsedCourseCode,
  virtual: boolean,
): Promise<CourseSchedule | null> {
  const safeCatalog = course.catalogNbr.replace(/[^A-Za-z0-9]+/g, "_");
  const { banner, html } = await performSearch(
    clientInfo,
    termId,
    { subject: course.subject, catalogNbr: course.catalogNbr, virtual },
    `c${safeCatalog}`,
  );
  if (banner !== "none") return null;
  const schedules = parseSearchResultsHtml(html, virtual);
  return schedules.find((s) => s.courseCode === course.code) ?? schedules[0] ?? null;
}

/**
 * Fetch every scheduled course for a subject in one virtual/non-virtual pass:
 * subject-only search, falling back to per-year-of-study slices on overflow, and finally to
 * per-catalogue-course searches if an individual slice still overflows.
 */
async function fetchSubjectPass(
  clientInfo: ClientInfo,
  termId: string,
  subject: string,
  virtual: boolean,
  subjectCourses: ParsedCourseCode[],
): Promise<CourseSchedule[]> {
  const subjectOnly = await fetchSubjectSlice(
    clientInfo,
    termId,
    subject,
    virtual,
    undefined,
    "all",
  );
  if (subjectOnly !== "overflow") return subjectOnly;

  const sliceResults: CourseSchedule[][] = [];
  let perCourseFallbackUsed = false;
  for (const year of YEAR_SLICES) {
    const slice = await fetchSubjectSlice(clientInfo, termId, subject, virtual, year, `y${year}`);
    if (slice !== "overflow") {
      sliceResults.push(slice);
      continue;
    }
    // A single year-of-study slice still exceeds the cap (not observed empirically): fall back to
    // exact per-course searches for this subject's catalogue courses just once.
    if (!perCourseFallbackUsed) {
      console.error(
        `Subject ${subject} year slice "${year}" still overflowed; falling back to per-course search.`,
      );
      perCourseFallbackUsed = true;
      const perCourse: CourseSchedule[] = [];
      for (const course of subjectCourses) {
        const schedule = await fetchCourseExact(clientInfo, termId, course, virtual);
        if (schedule) perCourse.push(schedule);
      }
      sliceResults.push(perCourse);
    }
  }
  return unionSchedulesByCourse(sliceResults);
}

/** Fetch a subject's schedules across both non-virtual and virtual passes, merged per course. */
async function fetchSubjectSchedules(
  clientInfo: ClientInfo,
  termId: string,
  subject: string,
  subjectCourses: ParsedCourseCode[],
): Promise<CourseSchedule[]> {
  const base = await fetchSubjectPass(clientInfo, termId, subject, false, subjectCourses);
  const virtualOnly = await fetchSubjectPass(clientInfo, termId, subject, true, subjectCourses);

  const byCode = new Map<string, CourseSchedule>();
  for (const schedule of base) byCode.set(schedule.courseCode, schedule);
  for (const vSchedule of virtualOnly) {
    const existing = byCode.get(vSchedule.courseCode);
    if (existing) {
      mergeVirtualIntoBase(existing, vSchedule);
    } else {
      byCode.set(vSchedule.courseCode, vSchedule);
    }
  }
  return Array.from(byCode.values());
}

async function tryLoadGradeLookups(): Promise<GradeLookups | null> {
  const gradesPath = path.join(SCRAPER_DATA_DIR, "grades.json");
  try {
    const raw = await fs.readFile(gradesPath, "utf-8");
    return buildGradeLookups(JSON.parse(raw) as unknown);
  } catch (err: unknown) {
    console.warn(
      `Could not load ${gradesPath} for grade enrichment (${getErrorMessage(err)}). Schedules will omit distribution.`,
    );
    return null;
  }
}

function createClientPool(clients: ClientInfo[]) {
  const available = [...clients];
  const waiters: ((c: ClientInfo) => void)[] = [];
  return {
    acquire(): Promise<ClientInfo> {
      const c = available.pop();
      if (c) return Promise.resolve(c);
      return new Promise<ClientInfo>((resolve) => waiters.push(resolve));
    },
    release(c: ClientInfo) {
      const waiter = waiters.shift();
      if (waiter) waiter(c);
      else available.push(c);
    },
  };
}

/** Exact per-course base + virtual fetch (used for ONLY_CATALOG debugging). */
async function fetchCourseSchedule(
  clientInfo: ClientInfo,
  course: ParsedCourseCode,
  termId: string,
): Promise<CourseSchedule | null> {
  const base = await fetchCourseExact(clientInfo, termId, course, false);
  const virtualOnly = await fetchCourseExact(clientInfo, termId, course, true);
  if (!base && !virtualOnly) return null;
  if (base && !virtualOnly) return base;
  if (!base && virtualOnly) return virtualOnly;
  return mergeVirtualIntoBase(base!, virtualOnly!);
}

export async function main(): Promise<void> {
  const onlySubject = process.env.ONLY_SUBJECT;
  const onlyCatalog = process.env.ONLY_CATALOG;
  const onlyTermId = process.env.ONLY_TERM_ID;

  const termsRaw = await fs.readFile(path.join(SCRAPER_DATA_DIR, "terms.json"), "utf-8");
  let terms: Term[] = (JSON.parse(termsRaw) as { terms: Term[] }).terms;

  if (onlyTermId) {
    terms = terms.filter((t) => t.termId === onlyTermId);
    if (terms.length === 0) {
      throw new Error(`ONLY_TERM_ID=${onlyTermId} not found in terms.json`);
    }
  }

  console.log("Initializing PeopleSoft session...");
  const clientCount = USE_CACHE_ONLY ? 1 : MAX_CONCURRENCY;
  const clientInfos: ClientInfo[] = await Promise.all(
    Array.from({ length: clientCount }, createClient),
  );
  console.log(`Initialized ${clientInfos.length} PeopleSoft session(s).`);

  const gradeLookups = await tryLoadGradeLookups();

  for (const term of terms) {
    const catalogueYear = getCatalogueYearForTerm(term.name);
    console.log(`Loading catalogue.${catalogueYear}.json for ${term.name}...`);
    const allCourses = await loadCatalogue(catalogueYear);
    console.log(`Found ${allCourses.length} unique course codes.`);

    const courses =
      onlySubject || onlyCatalog
        ? allCourses.filter((c) => {
            if (onlySubject && c.subject !== onlySubject) return false;
            if (onlyCatalog && c.catalogNbr !== onlyCatalog) return false;
            return true;
          })
        : allCourses;

    if (courses.length !== allCourses.length) {
      console.log(
        `Filtered to ${courses.length} course(s) based on ONLY_SUBJECT/ONLY_CATALOG environment variables.`,
      );
    }

    // Group catalogue courses by subject for subject-level searching + per-course fallback.
    const coursesBySubject = new Map<string, ParsedCourseCode[]>();
    for (const course of courses) {
      const list = coursesBySubject.get(course.subject) ?? [];
      list.push(course);
      coursesBySubject.set(course.subject, list);
    }
    const subjects = Array.from(coursesBySubject.keys()).sort();

    const pool = createClientPool(USE_CACHE_ONLY ? [clientInfos[0]] : clientInfos);
    const results: CourseSchedule[] = [];
    let processed = 0;

    console.log(
      `Starting schedule scrape for ${term.name} (${term.termId}) across ${subjects.length} subject(s)...`,
    );

    const tasks = subjects.map((subject) =>
      (async () => {
        const subjectCourses = coursesBySubject.get(subject) ?? [];
        const clientInfo = await pool.acquire();
        try {
          let subjectResults: CourseSchedule[];
          if (onlyCatalog) {
            // Debugging a specific course: use the exact per-course path.
            subjectResults = [];
            for (const course of subjectCourses) {
              const schedule = await fetchCourseSchedule(clientInfo, course, term.termId);
              if (schedule) subjectResults.push(schedule);
            }
          } else {
            subjectResults = await fetchSubjectSchedules(
              clientInfo,
              term.termId,
              subject,
              subjectCourses,
            );
          }
          for (const schedule of subjectResults) results.push(schedule);
        } catch (err: unknown) {
          console.error(
            `Error fetching schedules for subject ${subject} (${term.termId}):`,
            getErrorMessage(err),
          );
        } finally {
          pool.release(clientInfo);
          processed += 1;
          console.log(
            `[${term.termId}] Processed ${processed}/${subjects.length} subjects (${results.length} courses so far)...`,
          );
        }
      })(),
    );

    await Promise.all(tasks);

    results.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const output = {
      termId: term.termId,
      totalCourses: courses.length,
      totalWithSchedules: results.length,
      schedules: results,
    };

    if (gradeLookups) {
      const enrichmentStats = { sectionsTotal: 0, matched: 0, fallback: 0, none: 0 };
      enrichSchedulesPayload(output, gradeLookups, enrichmentStats);
      console.log(formatGradeEnrichmentLine(`Grades (${term.termId})`, enrichmentStats));
    }

    const outPath = path.join(SCRAPER_DATA_DIR, `schedules.${term.termId}.json`);
    await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
    console.log(
      `Done. Saved schedules for ${results.length} courses (out of ${courses.length}) to ${path.basename(outPath)}`,
    );
  }
}
