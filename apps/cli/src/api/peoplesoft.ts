import * as cheerio from "cheerio";

export interface PageState {
  icsid: string;
  icStateNum: string;
}

export function extractPageState(html: string): PageState {
  const $ = cheerio.load(html);
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
