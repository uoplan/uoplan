import * as cheerio from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { BASE_URL } from "./client.ts";

const ENROLL_LIST_URL = `${BASE_URL}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL`;
const ENROLL_CART_URL = `${BASE_URL}SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL`;

export interface CartItem {
  courseCode: string;
  title: string;
  section: string;
  units: string;
  status: string;
}

interface PageState {
  icsid: string;
  icStateNum: string;
}

function extractPageState(html: string): PageState {
  const $ = cheerio.load(html);
  return {
    icsid: $("#ICSID").attr("value") ?? "",
    icStateNum: $("#ICStateNum").attr("value") ?? "1",
  };
}

function buildFormBody(
  action: string,
  state: PageState,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
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
  });
  return params.toString();
}

export async function listCart(client: PeopleSoftClient): Promise<CartItem[]> {
  const initRes = await client.get(ENROLL_LIST_URL);
  const $ = cheerio.load(initRes.body as string);

  const items: CartItem[] = [];

  // PeopleSoft renders cart rows as table rows with a specific structure.
  // Selectors are best-guesses based on standard PeopleSoft enrollment list markup;
  // update after inspecting the live page.
  $("tr[id^='trSSR_REGFORM_VW']").each((_i, row) => {
    const cells = $(row).find("td");
    const courseCode = cells.eq(0).text().trim();
    const title = cells.eq(1).text().trim();
    const section = cells.eq(2).text().trim();
    const units = cells.eq(3).text().trim();
    const status = cells.eq(4).text().trim();

    if (courseCode) {
      items.push({ courseCode, title, section, units, status });
    }
  });

  return items;
}

export async function addToCart(client: PeopleSoftClient, courseCode: string): Promise<void> {
  // Step 1: load the cart page to get state.
  const initRes = await client.get(ENROLL_CART_URL);
  const state = extractPageState(initRes.body as string);

  // Step 2: submit the add-to-cart action.
  // The exact field names and ICAction depend on the live page structure;
  // update after inspecting the form with DevTools.
  await client.post(ENROLL_CART_URL, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_REGFRM1_SSR_PB_ADDTOLIST", state, {
      DERIVED_REGFRM1_CLASS_NBR: courseCode,
    }),
  });
}
