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
    ICSID: state.icsid,
    ICActionPrompt: "false",
    ICTypeAheadID: "",
    ICChanged: "-1",
    ICResubmit: "0",
    ICAJAX: "0",
    ...extra,
  }).toString();
}
