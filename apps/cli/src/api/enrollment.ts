import { load } from "cheerio";
import type { PeopleSoftClient } from "./client.ts";
import { ENDPOINTS } from "./endpoints.ts";
import { extractPageState, buildFormBody } from "./peoplesoft.ts";

export interface EnrollmentResult {
  enrolled: string[];
  errors: string[];
}

export async function checkout(client: PeopleSoftClient): Promise<EnrollmentResult> {
  const initRes = await client.get(ENDPOINTS.enrollCart);
  const state = extractPageState(initRes.body as string);

  // ICAction TBD — update after inspecting the live checkout form.
  const res = await client.post(ENDPOINTS.enrollCart, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildFormBody("DERIVED_REGFRM1_SSR_PB_SUBMIT", state),
  });

  const $ = load(res.body as string);
  const enrolled: string[] = [];
  const errors: string[] = [];

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
