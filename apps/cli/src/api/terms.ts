import type { PeopleSoftClient } from "./client.ts";
import { ENDPOINTS } from "./endpoints.ts";
import {
  type Term,
  extractPageState,
  buildTermSelectBody,
  parseTermsFromHtml,
  parseStrmFromHtml,
} from "./peoplesoft.ts";

export type { Term };

export async function listTerms(client: PeopleSoftClient): Promise<Term[]> {
  const res = await client.get(ENDPOINTS.termList);
  return parseTermsFromHtml(res.body as string);
}

export async function selectTerm(client: PeopleSoftClient, termIndex: number): Promise<string> {
  const res = await client.get(ENDPOINTS.termList);
  const state = extractPageState(res.body as string);

  const postRes = await client.post(ENDPOINTS.termList, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildTermSelectBody(state, termIndex),
    followRedirect: false,
    throwHttpErrors: false,
  });

  const strm = parseStrmFromHtml(postRes.body as string);
  if (!strm) throw new Error("Could not determine STRM from term selection response.");
  return strm;
}
