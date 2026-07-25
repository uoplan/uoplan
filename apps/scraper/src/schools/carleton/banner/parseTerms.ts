import * as cheerio from "cheerio";
import type { Term } from "@uoplan/domain/dataTypes";
import { normalizeSpaces } from "./utils.ts";

function naturalTermName(raw: string): string {
  return normalizeSpaces(raw).replace(/\s*\([^)]*\)\s*$/, "");
}

export function parseTerms(html: string): { terms: Term[]; sessionId: string } {
  const $ = cheerio.load(html);
  const sessionId = normalizeSpaces($('input[name="session_id"]').attr("value") ?? "");
  const terms: Term[] = [];
  const seen = new Set<string>();

  $('select[name="term_code"] option').each((_, option) => {
    const termId = normalizeSpaces($(option).attr("value") ?? "");
    const name = naturalTermName($(option).text());
    if (!termId || !name || seen.has(termId)) return;
    seen.add(termId);
    terms.push({ termId, name });
  });

  return { terms, sessionId };
}
