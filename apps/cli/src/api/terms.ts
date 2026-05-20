import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { ENDPOINTS } from "./endpoints.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

export interface Term {
  index: number;
  name: string;
  career: string;
  institution: string;
}

export async function listTerms(client: PeopleSoftClient): Promise<Term[]> {
  const res = await client.get(ENDPOINTS.termList);
  const $ = load(res.body as string);
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

export async function selectTerm(client: PeopleSoftClient, termIndex: number): Promise<void> {
  const res = await client.get(ENDPOINTS.termList);
  const state = extractPageState(res.body as string);

  await client.post(ENDPOINTS.termList, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_SSS_SCT_SSR_PB_GO", state, {
      ICAJAX: "1",
      "#ICDataLang": "ENG",
      DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$: "",
      SSR_DUMMY_RECV1$sels$0$$0: String(termIndex),
      DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$: "",
    }),
  });
}
