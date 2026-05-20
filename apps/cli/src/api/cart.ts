import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { BASE_URL } from "./client.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

const ENROLL_LIST_URL = `${BASE_URL}SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL`;
const ENROLL_CART_URL = `${BASE_URL}SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL`;

export interface CartItem {
  courseCode: string;
  title: string;
  section: string;
  units: string;
  status: string;
}

export async function listCart(client: PeopleSoftClient): Promise<CartItem[]> {
  const res = await client.get(ENROLL_LIST_URL);
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
  const initRes = await client.get(ENROLL_CART_URL);
  const state = extractPageState(initRes.body as string);

  // ICAction and field names TBD — update after inspecting the live cart form.
  await client.post(ENROLL_CART_URL, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_REGFRM1_SSR_PB_ADDTOLIST", state, {
      DERIVED_REGFRM1_CLASS_NBR: classNumber,
    }),
  });
}
