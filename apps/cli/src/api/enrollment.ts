import * as cheerio from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { BASE_URL } from "./client.ts";

const ENROLL_URL = `${BASE_URL}SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL`;

export interface EnrollmentResult {
  enrolled: string[];
  errors: string[];
}

function extractPageState(html: string) {
  const $ = cheerio.load(html);
  return {
    icsid: $("#ICSID").attr("value") ?? "",
    icStateNum: $("#ICStateNum").attr("value") ?? "1",
  };
}

export async function checkout(client: PeopleSoftClient): Promise<EnrollmentResult> {
  const initRes = await client.get(ENROLL_URL);
  const state = extractPageState(initRes.body as string);

  const params = new URLSearchParams({
    ICType: "Panel",
    ICElementNum: "0",
    ICStateNum: state.icStateNum,
    // Submit/proceed action — update after inspecting the live checkout form.
    ICAction: "DERIVED_REGFRM1_SSR_PB_SUBMIT",
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
  });

  const res = await client.post(ENROLL_URL, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const $ = cheerio.load(res.body as string);
  const enrolled: string[] = [];
  const errors: string[] = [];

  // Parse success and error messages from PeopleSoft's standard alert/message areas.
  $(".PSMSGDESCLONG, .SSSMSGALERTTEXT").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) errors.push(text);
  });

  $(".PSTEXT, .SSSMSGSUCCESSTEXT").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) enrolled.push(text);
  });

  return { enrolled, errors };
}
