import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { ENDPOINTS } from "./endpoints.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

export interface CartItem {
  courseCode: string;
  title: string;
  section: string;
  units: string;
  status: string;
}

export async function listCart(client: PeopleSoftClient): Promise<CartItem[]> {
  const res = await client.get(ENDPOINTS.enrollList);
  const $ = load(res.body as string);
  const items: CartItem[] = [];

  // Selectors are best-guesses from standard PeopleSoft enrollment list markup;
  // update after inspecting the live page with DevTools.
  $("tr[id^='trSSR_REGFORM_VW']").each((_i, row) => {
    const cells = $(row).find("td");
    const courseCode = cells.eq(0).text().trim();
    if (!courseCode) return;
    items.push({
      courseCode,
      title: cells.eq(1).text().trim(),
      section: cells.eq(2).text().trim(),
      units: cells.eq(3).text().trim(),
      status: cells.eq(4).text().trim(),
    });
  });

  return items;
}

export async function addToCart(client: PeopleSoftClient, classNumber: string): Promise<void> {
  const initRes = await client.get(ENDPOINTS.enrollCart);
  const state = extractPageState(initRes.body as string);

  // ICAction and field names TBD — update after inspecting the live cart form.
  await client.post(ENDPOINTS.enrollCart, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_REGFRM1_SSR_PB_ADDTOLIST", state, {
      DERIVED_REGFRM1_CLASS_NBR: classNumber,
    }),
  });
}
