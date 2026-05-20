import { load } from "cheerio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PeopleSoftClient } from "./client.ts";
import { extractPageState } from "./peoplesoft.ts";
import type { PageState } from "./peoplesoft.ts";

export interface SearchResult {
  /** Row index N from the result grid — used as ICAction suffix for SSR_PB_SELECT$N */
  rowIndex: number;
  classNbr: string;
  section: string;
  days: string;
  room: string;
  instructor: string;
  status: string;
}

export interface CompanionPage {
  label: string;
  options: CompanionOption[];
}

export interface CompanionOption {
  /** Row's bufnum attribute — used as the radio value in submission */
  index: number;
  section: string;
  schedule: string;
  room: string;
  instructor: string;
  status: string;
}

export function parseCourseCode(raw: string): { subject: string; catalogNbr: string } {
  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^([A-Z]{2,4})(\d{3,4})$/);
  if (!match) throw new Error(`Invalid course code: ${raw}. Expected format like CSI2101.`);
  return { subject: match[1], catalogNbr: match[2] };
}

// PeopleSoft AJAX responses are XML wrappers. Extract ICStateNum and ICSID from them.
// ICStateNum lives in inline JS; ICSID lives in the embedded HTML — use cheerio to
// handle any attribute order rather than relying on a fragile regex.
function extractAjaxState(xml: string): PageState {
  const stateNumMatch = xml.match(/ICStateNum\.value=(\d+)/);
  const $ = load(extractPageHtml(xml));
  return {
    icStateNum: stateNumMatch?.[1] ?? "1",
    icsid: $("#ICSID").attr("value") ?? "",
  };
}

// Extract the PAGECONTAINER HTML blob from a PeopleSoft AJAX XML response.
function extractPageHtml(xml: string): string {
  const match = xml.match(/<FIELD id='win0divPAGECONTAINER'><!\[CDATA\[([\s\S]*?)\]\]><\/FIELD>/);
  return match?.[1] ?? xml;
}

// Selectable rows: class number links with PSHYPERLINK class (not PSHYPERLINKDISABLED).
// Works for both standalone search and cart search result pages.
export function parseSearchResults(xml: string): SearchResult[] {
  const html = extractPageHtml(xml);
  const $ = load(html);
  const results: SearchResult[] = [];

  $("a.PSHYPERLINK[id^='MTG_CLASS_NBR$']").each((_i, el) => {
    const id = $(el).attr("id") ?? "";
    const rowMatch = id.match(/MTG_CLASS_NBR\$(\d+)$/);
    if (!rowMatch) return;
    const rowIndex = parseInt(rowMatch[1], 10);

    const classNbr = $(el).text().trim();
    const section = $(`#MTG_CLASSNAME\\$${rowIndex}`).text().replace(/\s+/g, " ").trim();
    const days = $(`#MTG_DAYTIME\\$${rowIndex}`).text().replace(/\s+/g, " ").trim();
    const room = $(`#MTG_ROOM\\$${rowIndex}`).text().split("\n")[0]?.trim() ?? "";
    const rawInstructor = $(`#MTG_INSTR\\$${rowIndex}`).text().trim();
    const instructor = [
      ...new Set(
        rawInstructor
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].join(", ");
    const statusDiv = $(`#win0divDERIVED_CLSRCH_SSR_STATUS_LONG\\$${rowIndex}`);
    const status = statusDiv.find("img").attr("alt") ?? statusDiv.text().trim();

    results.push({ rowIndex, classNbr, section, days, room, instructor, status });
  });

  return results;
}

// Companion page: the section companion-selection grid is present.
export function isCompanionPage(xml: string): boolean {
  return xml.includes("SSR_CLS_TBL_R1$scroll");
}

export function isWaitlistPage(xml: string): boolean {
  return xml.includes("DERIVED_CLS_DTL_WAIT_LIST_OKAY");
}

export function parseCompanionPage(xml: string): CompanionPage {
  const html = extractPageHtml(xml);
  const $ = load(html);

  // Label is the first grid label inside the companion grid container
  const label =
    $("[id^='win0divSSR_CLS_TBL_R1$']")
      .first()
      .find("[id^='win0divSSR_CLS_TBL_R1GP']")
      .first()
      .text()
      .trim() ||
    $("[id^='win0divSSR_CLS_TBL_R1GP']").first().text().trim() ||
    "Select accompanying section";

  const options: CompanionOption[] = [];

  // Rows: trSSR_CLS_TBL_R1$N_rowM — use bufnum attribute as the radio value
  $("tr[id^='trSSR_CLS_TBL_R1']").each((_i, row) => {
    const bufnum = parseInt($(row).attr("bufnum") ?? "", 10);
    if (isNaN(bufnum)) return;

    const cells = $(row).find("td");
    // Col 0: radio, Col 1: Class Nbr, Col 2: Section, Col 3: Schedule, Col 4: Room, Col 5: Instructor, Col 6: Status
    const classNbr = cells.eq(1).text().trim();
    const sectionText = cells.eq(2).text().trim();
    const schedule = cells.eq(3).text().replace(/\s+/g, " ").trim();
    const room = cells.eq(4).text().trim();
    const instructor = cells.eq(5).text().trim();
    const statusImg = cells.eq(6).find("img").attr("alt") ?? cells.eq(6).text().trim();

    options.push({
      index: bufnum,
      section: [classNbr, sectionText].filter(Boolean).join(" "),
      schedule,
      room,
      instructor,
      status: statusImg,
    });
  });

  return { label, options };
}

export function parseWaitlistId(xml: string): string | null {
  const match = xml.match(/DERIVED_CLS_DTL_WAIT_LIST_OKAY\$(\d+)/);
  return match?.[1] ?? null;
}

export function parseConfirmActionId(xml: string): string {
  const match = xml.match(/name=["']DERIVED_CLS_DTL_NEXT_PB\$(\d+)\$/);
  return match ? `DERIVED_CLS_DTL_NEXT_PB$${match[1]}$` : "DERIVED_CLS_DTL_NEXT_PB$280$";
}

async function debugDump(step: string, content: string): Promise<void> {
  await writeFile(join("/tmp", `uoplan-search-${step}.html`), content, "utf8").catch(() => {});
}

function buildAjaxBody(
  action: string,
  state: PageState,
  extra: Record<string, string> = {},
): string {
  return new URLSearchParams({
    ICAJAX: "1",
    ICNAVTYPEDROPDOWN: "0",
    ICType: "Panel",
    ICElementNum: "0",
    ICStateNum: state.icStateNum,
    ICAction: action,
    ICModelCancel: "0",
    ICXPos: "0",
    ICYPos: "0",
    ResponsetoDiffFrame: "-1",
    TargetFrameName: "None",
    FacetPath: "None",
    PrmtTbl: "",
    PrmtTbl_fn: "",
    PrmtTbl_fv: "",
    TA_SkipFldNms: "",
    ICFocus: "",
    ICSaveWarningFilter: "0",
    ICChanged: "-1",
    ICSkipPending: "0",
    ICAutoSave: "0",
    ICResubmit: "0",
    ICSID: state.icsid,
    ICActionPrompt: "false",
    ICTypeAheadID: "",
    ICBcDomData: "UnknownValue",
    ICPanelName: "",
    ICFind: "",
    ICAddCount: "",
    ICAppClsData: "",
    "#ICDataLang": "ENG",
    DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$: "",
    DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$: "",
    ...extra,
  }).toString();
}

/**
 * Search for courses from the cart page.
 * Flow: GET cart → open search panel → POST search → return results.
 */
export async function searchCourses(
  client: PeopleSoftClient,
  cartUrl: string,
  subject: string,
  catalogNbr: string,
): Promise<{ results: SearchResult[]; xml: string }> {
  // Step 1: GET the cart page for initial state
  const initRes = await client.get(cartUrl);
  const initHtml = initRes.body as string;
  await debugDump("0-init", initHtml);
  const initState = extractPageState(initHtml);

  // Step 2: Open the search panel on the cart page
  const panelXml = (
    await client.post(cartUrl, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildAjaxBody("DERIVED_REGFRM1_SSR_PB_SRCH", initState, {
        DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$: "06",
      }),
    })
  ).body as string;
  await debugDump("1-panel", panelXml);
  const panelState = extractAjaxState(panelXml);

  // Step 3: POST the actual class search
  const xml = (
    await client.post(cartUrl, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildAjaxBody("CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH", panelState, {
        SSR_CLSRCH_WRK_ACAD_CAREER$0: "",
        SSR_CLSRCH_WRK_SUBJECT$1: subject,
        SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$2: "E",
        SSR_CLSRCH_WRK_CATALOG_NBR$2: catalogNbr,
        SSR_CLSRCH_WRK_SSR_COMPONENT$3: "",
        SSR_CLSRCH_WRK_CAMPUS$4: "",
        SSR_CLSRCH_WRK_LOCATION$5: "",
        SSR_CLSRCH_WRK_CRSE_ATTR$6: "",
        DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$: "06",
      }),
    })
  ).body as string;

  await debugDump("2-search", xml);
  return { results: parseSearchResults(xml), xml };
}

/** Select a section by clicking its SSR_PB_SELECT$N button. */
export async function selectSection(
  client: PeopleSoftClient,
  cartUrl: string,
  xml: string,
  rowIndex: number,
): Promise<string> {
  const state = extractAjaxState(xml);

  const result = (
    await client.post(cartUrl, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildAjaxBody(`SSR_PB_SELECT$${rowIndex}`, state, {
        ICXPos: "350",
        ICYPos: "397.5",
      }),
    })
  ).body as string;

  await debugDump("3-select", result);
  return result;
}

/** Submit a companion class selection (radio button pick) and advance to the next page. */
export async function submitCompanionSelection(
  client: PeopleSoftClient,
  cartUrl: string,
  xml: string,
  companionIndex: number,
  pageNum: number,
): Promise<string> {
  const state = extractAjaxState(xml);

  const result = (
    await client.post(cartUrl, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildAjaxBody("DERIVED_CLS_DTL_NEXT_PB", state, {
        [`SSR_CLS_TBL_R1$sels$0$$${companionIndex}`]: String(companionIndex),
      }),
    })
  ).body as string;

  await debugDump(`4-companion-${pageNum}`, result);
  return result;
}

/** Confirm enrollment (always accepts waitlist). */
export async function confirmEnrollment(
  client: PeopleSoftClient,
  cartUrl: string,
  xml: string,
): Promise<string> {
  const state = extractAjaxState(xml);
  const action = parseConfirmActionId(xml);
  const waitlistId = parseWaitlistId(xml);

  const extra: Record<string, string> = { ICYPos: "38" };
  if (waitlistId) {
    extra[`DERIVED_CLS_DTL_WAIT_LIST_OKAY$${waitlistId}$$chk`] = "Y";
    extra[`DERIVED_CLS_DTL_WAIT_LIST_OKAY$${waitlistId}$`] = "Y";
  }

  const result = (
    await client.post(cartUrl, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildAjaxBody(action, state, extra),
    })
  ).body as string;

  await debugDump("5-confirm", result);
  return result;
}

export interface ConfirmMessages {
  errors: string[];
  /** Success/info notices from PeopleSoft (e.g. "CSI 2101 has been added to your Shopping Cart.") */
  notices: string[];
}

export function parseConfirmMessages(xml: string): ConfirmMessages {
  const html = extractPageHtml(xml);
  const $ = load(html);

  // If a confirm icon is present, all messages are success/info notices, not errors.
  const isSuccess = html.includes("PS_CS_MESSAGE_CONFIRM_ICN");

  const messages: string[] = [];
  $("[id^='DERIVED_SASSMSG_ERROR_TEXT$']").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) messages.push(text);
  });

  return isSuccess ? { errors: [], notices: messages } : { errors: messages, notices: [] };
}

/** @deprecated Use parseConfirmMessages */
export function parseConfirmErrors(xml: string): string[] {
  return parseConfirmMessages(xml).errors;
}
