import { load } from "cheerio";

export interface Term {
  index: number;
  name: string;
  career: string;
  institution: string;
}

export interface PageState {
  icsid: string;
  icStateNum: string;
}

export function extractPageState(html: string): PageState {
  const $ = load(html);
  return {
    icsid: $("#ICSID").attr("value") ?? "",
    icStateNum: $("#ICStateNum").attr("value") ?? "1",
  };
}

export function buildFormBody(
  action: string,
  state: PageState,
  extra: Record<string, string> = {},
): string {
  return new URLSearchParams({
    ICAJAX: "0",
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
    ...extra,
  }).toString();
}

export function buildTermSelectBody(state: PageState, termIndex: number): string {
  return buildFormBody("DERIVED_SSS_SCT_SSR_PB_GO", state, {
    ICAJAX: "0",
    "#ICDataLang": "ENG",
    DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$: "",
    SSR_DUMMY_RECV1$sels$0$$0: String(termIndex),
    DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$: "",
  });
}

export function isTermSelectionPage(body: string): boolean {
  return body.includes("SSR_DUMMY_RECV1$scroll$0");
}

export function parseTermsFromHtml(html: string): Term[] {
  const $ = load(html);
  const terms: Term[] = [];

  $("tr[id^='trSSR_DUMMY_RECV1$0_row']").each((_i, row) => {
    const bufnum = parseInt($(row).attr("bufnum") ?? "", 10);
    const name = $(`#TERM_CAR\\$${bufnum}`, row).text().trim();
    if (!name) return;
    terms.push({
      index: bufnum,
      name,
      career: $(`#CAREER\\$${bufnum}`, row).text().trim(),
      institution: $(`#INSTITUTION\\$${bufnum}`, row).text().trim(),
    });
  });

  return terms;
}

export function parseStrmFromHtml(html: string): string | null {
  return html.match(/[?&]STRM=(\d{4})/)?.[1] ?? null;
}
