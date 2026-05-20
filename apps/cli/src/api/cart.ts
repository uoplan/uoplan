import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

export interface CartItem {
  section: string;
  classNumber: string;
  schedule: string;
  room: string;
  instructor: string;
  units: string;
}

export async function listCart(client: PeopleSoftClient, cartUrl: string): Promise<CartItem[]> {
  const res = await client.get(cartUrl);
  const $ = load(res.body as string);
  const items: CartItem[] = [];

  $("tr[id^='trSSR_REGFORM_VW']").each((_i, row) => {
    const bufnum = parseInt($(row).attr("bufnum") ?? "", 10);
    if (isNaN(bufnum)) return;

    const classText = $(`#P_CLASS_NAME\\$${bufnum}`).text().trim();
    const classMatch = classText.match(/^([^\n(]+).*\((\d+)\)/s);
    const section = classMatch?.[1].trim() ?? classText;
    const classNumber = classMatch?.[2] ?? "";

    if (!section) return;

    items.push({
      section,
      classNumber,
      schedule: $(`#DERIVED_REGFRM1_SSR_MTG_SCHED_LONG\\$${bufnum}`)
        .text()
        .trim()
        .replace(/\s+/g, " "),
      room: $(`#DERIVED_REGFRM1_SSR_MTG_LOC_LONG\\$${bufnum}`).text().trim().replace(/\s+/g, " "),
      instructor: $(`#DERIVED_REGFRM1_SSR_INSTR_LONG\\$${bufnum}`).text().trim(),
      units: $(`#SSR_REGFORM_VW_UNT_TAKEN\\$${bufnum}`).text().trim().replace(/ /g, ""),
    });
  });

  return items;
}

export async function addToCart(
  client: PeopleSoftClient,
  cartUrl: string,
  classNumber: string,
): Promise<void> {
  const initRes = await client.get(cartUrl);
  const state = extractPageState(initRes.body as string);

  await client.post(cartUrl, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_REGFRM1_SSR_PB_ADDTOLIST", state, {
      DERIVED_REGFRM1_CLASS_NBR: classNumber,
    }),
  });
}
