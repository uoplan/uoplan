import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { extractPageState } from "./peoplesoft.ts";

export const CART_ACTIONS = {
  enrol: "DERIVED_REGFRM1_LINK_ADD_ENRL$291$",
  delete: "DERIVED_REGFRM1_SSR_PB_DELETE$287$",
} as const;

export async function submitCartAction(
  client: PeopleSoftClient,
  cartUrl: string,
  butnums: number[],
  action: string,
): Promise<{ html: string; errors: string[] }> {
  const initRes = await client.get(cartUrl);
  const state = extractPageState(initRes.body as string);

  const selections: Record<string, string> = {};
  for (const n of butnums) {
    selections[`P_SELECT$chk$${n}`] = "Y";
    selections[`P_SELECT$${n}`] = "Y";
  }

  const body = new URLSearchParams({
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
    DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$: "06",
    ...selections,
    DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$: "",
  }).toString();

  const res = await client.post(cartUrl, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const html = res.body as string;
  const $ = load(html);
  const errors: string[] = [];
  $("[id^='DERIVED_SASSMSG_ERROR_TEXT$']").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) errors.push(text);
  });

  return { html, errors };
}
