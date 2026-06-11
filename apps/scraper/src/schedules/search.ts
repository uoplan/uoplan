import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import type { Got } from "got";
import { getErrorMessage } from "../shared/errors.ts";
import { bootstrapPeopleSoft, PEOPLESOFT_CLASS_SEARCH_URL } from "../shared/peoplesoft.ts";
import type { CourseSchedule, ParsedCourseCode } from "./parse.ts";
import { parseSearchResultsHtml } from "./parse.ts";
import { mergeVirtualIntoBase, unionSchedulesByCourse } from "./mergeSchedules.ts";

const BASE_URL = PEOPLESOFT_CLASS_SEARCH_URL;
const HTML_CACHE_DIR = ".cache/course-search-html";
export const MAX_CONCURRENCY = 50;
export const USE_CACHE_ONLY = process.argv.includes("use-cache");
const WRITE_CACHE = process.argv.includes("write-cache");

export interface ClientInfo {
  client: Got;
  icsid: string;
  dataLang: string;
  icStateNum: string;
}

export async function createClient(): Promise<ClientInfo> {
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

const PEOPLESOFT_PANEL_PREFIX_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["ICType", "Panel"],
  ["ICElementNum", "0"],
];

const PEOPLESOFT_PANEL_POST_STATE_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["ICAction", "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"],
  ["ICModelCancel", "0"],
  ["ICXPos", "0"],
  ["ICYPos", "0"],
  ["ResponsetoDiffFrame", "-1"],
  ["TargetFrameName", "None"],
  ["FacetPath", "None"],
  ["PrmtTbl", ""],
  ["PrmtTbl_fn", ""],
  ["PrmtTbl_fv", ""],
  ["TA_SkipFldNms", ""],
  ["ICFocus", ""],
  ["ICSaveWarningFilter", "0"],
  ["ICChanged", "-1"],
  ["ICSkipPending", "0"],
  ["ICAutoSave", "0"],
  ["ICResubmit", "0"],
];

const PEOPLESOFT_PANEL_SUFFIX_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["ICActionPrompt", "false"],
  ["ICTypeAheadID", ""],
  ["ICBcDomData", ""],
  ["ICPanelName", ""],
  ["ICFind", ""],
  ["ICAddCount", ""],
  ["ICAppClsData", ""],
];

const NEUTRAL_CRITERIA_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["SSR_CLSRCH_WRK_ACAD_CAREER$0", ""],
  ["SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$0", "N"],
  ["SSR_CLSRCH_WRK_SSR_OPEN_ONLY$0", "N"],
  ["UO_PUB_SRCH_WRK_ACAD_GROUP$0", ""],
  ["SSR_CLSRCH_WRK_DESCR$0", ""],
  ["UO_PUB_SRCH_WRK_UO_LNG_FR$chk$0", "N"],
  ["UO_PUB_SRCH_WRK_UO_LNG_EN$chk$0", "N"],
  ["UO_PUB_SRCH_WRK_UO_LNG_OT$chk$0", "N"],
  ["UO_PUB_SRCH_WRK_UO_LNG_BI$chk$0", "N"],
];

const MEETING_FILTER_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["SSR_CLSRCH_WRK_SSR_START_TIME_OPR$0", "GE"],
  ["SSR_CLSRCH_WRK_MEETING_TIME_START$0", ""],
  ["SSR_CLSRCH_WRK_SSR_END_TIME_OPR$0", "LE"],
  ["SSR_CLSRCH_WRK_MEETING_TIME_END$0", ""],
  ["SSR_CLSRCH_WRK_INCLUDE_CLASS_DAYS$0", "I"],
  ["SSR_CLSRCH_WRK_MON$chk$0", ""],
  ["SSR_CLSRCH_WRK_TUES$chk$0", ""],
  ["SSR_CLSRCH_WRK_WED$chk$0", ""],
  ["SSR_CLSRCH_WRK_THURS$chk$0", ""],
  ["SSR_CLSRCH_WRK_FRI$chk$0", ""],
  ["SSR_CLSRCH_WRK_SAT$chk$0", ""],
  ["SSR_CLSRCH_WRK_SUN$chk$0", ""],
  ["SSR_CLSRCH_WRK_SSR_EXACT_MATCH2$0", "B"],
  ["SSR_CLSRCH_WRK_LAST_NAME$0", ""],
  ["SSR_CLSRCH_WRK_SSR_COMPONENT$0", ""],
  ["SSR_CLSRCH_WRK_SESSION_CODE$0", ""],
  ["SSR_CLSRCH_WRK_INSTRUCTION_MODE$0", ""],
];

const ONLINE_FILTER_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["UO_PUB_SRCH_WRK_UO_ONLINE_COURSES$chk$0", "N"],
  ["UO_PUB_SRCH_WRK_UO_AUDITOR_PERMITD$chk$0", "N"],
  ["UO_PUB_SRCH_WRK_UO_UOTTA_CARLETON$chk$0", "N"],
];

function setFields(
  params: URLSearchParams,
  fields: ReadonlyArray<readonly [string, string]>,
): void {
  for (const [key, value] of fields) params.set(key, value);
}

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

  setFields(params, PEOPLESOFT_PANEL_PREFIX_FIELDS);
  params.set("ICStateNum", icStateNum);
  setFields(params, PEOPLESOFT_PANEL_POST_STATE_FIELDS);
  params.set("ICSID", icsid);
  setFields(params, PEOPLESOFT_PANEL_SUFFIX_FIELDS);

  params.set("#ICDataLang", dataLang || "ENG");
  if (termId) {
    params.set("CLASS_SRCH_WRK2_STRM$35$", termId);
  }

  params.set("SSR_CLSRCH_WRK_SUBJECT$0", subject);
  params.set("SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$0", "E");
  params.set("SSR_CLSRCH_WRK_CATALOG_NBR$0", catalogNbr ?? "");

  setFields(params, NEUTRAL_CRITERIA_FIELDS);
  for (const opt of ["01", "02", "03", "04"] as const) {
    const on = yearOfStudy === Number(opt);
    params.set(`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_${opt}$chk$0`, on ? "Y" : "N");
    if (on) params.set(`UO_PUB_SRCH_WRK_SSR_RPTCK_OPT_${opt}$0`, "Y");
  }
  const gradOn = yearOfStudy === "grad";
  params.set("UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$chk$0", gradOn ? "Y" : "N");
  if (gradOn) params.set("UO_PUB_SRCH_WRK_GRADUATED_TBL_CD$0", "Y");
  setFields(params, MEETING_FILTER_FIELDS);
  params.set("SSR_CLSRCH_WRK_LOCATION$0", virtual ? "ZZVIRTL" : "");
  setFields(params, ONLINE_FILTER_FIELDS);

  return params.toString();
}

const YEAR_SLICES: YearOfStudy[] = [1, 2, 3, 4, "grad"];

type BannerKind = "none" | "empty" | "overflow";

/** Classify the PeopleSoft response banner before attempting to parse results. */
function classifyBanner(html: string): BannerKind {
  const text = cheerio
    .load(html)("span.PSERRORTEXT, div.PSERRORTEXT, span.SSSMSGALERTTEXT")
    .text()
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return "none";
  if (text.includes("maximum limit") || text.includes("exceed")) return "overflow";
  if (text.includes("no classes") || text.includes("no results")) return "empty";
  return "none";
}

function refreshPeopleSoftState(clientInfo: ClientInfo, response: { body: string }): void {
  try {
    const $ = cheerio.load(response.body);
    const icsid = $("#ICSID").attr("value");
    if (icsid) clientInfo.icsid = icsid;
    const stateNum = $("#ICStateNum").attr("value");
    if (stateNum) clientInfo.icStateNum = stateNum;
  } catch {
    // Keep the previous state when PeopleSoft returns a transient non-search page.
  }
}

async function performSearch(
  clientInfo: ClientInfo,
  termId: string,
  sp: { subject: string; catalogNbr?: string; yearOfStudy?: YearOfStudy; virtual: boolean },
  cacheLabel: string,
): Promise<{ banner: BannerKind; html: string }> {
  const { dataLang } = clientInfo;
  const safeSubject = sp.subject.replaceAll(/[^A-Za-z0-9]+/g, "_");
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
    const initRes = await clientInfo.client.get(BASE_URL);
    refreshPeopleSoftState(clientInfo, initRes);

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
    refreshPeopleSoftState(clientInfo, res);

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
  const safeCatalog = course.catalogNbr.replaceAll(/[^A-Za-z0-9]+/g, "_");
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
export async function fetchSubjectSchedules(
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

/** Exact per-course base + virtual fetch (used for ONLY_CATALOG debugging). */
export async function fetchCourseSchedule(
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
