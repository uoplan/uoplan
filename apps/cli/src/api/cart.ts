import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

export interface CartItem {
  courseCode: string;
  section: string;
  classNumber: string;
  instructors: string[];
  units: string;
  bufnum: number;
}

export function parseCart(html: string): CartItem[] {
  const $ = load(html);

  interface RawRow {
    bufnum: number;
    hasCheckbox: boolean;
    instructor: string;
    classText: string;
    units: string;
  }

  const rawRows: RawRow[] = [];

  $("tr[id^='trSSR_REGFORM_VW']").each((_i, row) => {
    const bufnum = parseInt($(row).attr("bufnum") ?? "", 10);
    if (isNaN(bufnum)) return;

    rawRows.push({
      bufnum,
      hasCheckbox: $(`#P_SELECT\\$chk\\$${bufnum}`).length > 0,
      instructor: $(`#DERIVED_REGFRM1_SSR_INSTR_LONG\\$${bufnum}`).text().trim(),
      classText: $(`#P_CLASS_NAME\\$${bufnum}`).text().trim(),
      units: $(`#SSR_REGFORM_VW_UNT_TAKEN\\$${bufnum}`).text().trim().replace(/ /g, ""),
    });
  });

  const items: CartItem[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row.hasCheckbox) continue;

    const classMatch = row.classText.match(/^([^\n(]+).*\((\d+)\)/s);
    const section = classMatch?.[1].trim() ?? row.classText;
    const classNumber = classMatch?.[2] ?? "";
    if (!section) continue;

    const courseCodeMatch = section.match(/^([A-Z]{2,4}\s*\d{3,4})/i);
    const courseCode = courseCodeMatch?.[1].replace(/\s+/, " ") ?? section;

    const instructorSet = new Set<string>();
    for (let j = i; j < rawRows.length; j++) {
      if (j > i && rawRows[j].hasCheckbox) break;
      const name = rawRows[j].instructor;
      if (name) instructorSet.add(name);
    }

    items.push({
      courseCode,
      section,
      classNumber,
      instructors: [...instructorSet],
      units: row.units,
      bufnum: row.bufnum,
    });
  }

  return items;
}

export async function listCart(client: PeopleSoftClient, cartUrl: string): Promise<CartItem[]> {
  const res = await client.get(cartUrl);
  return parseCart(res.body as string);
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
