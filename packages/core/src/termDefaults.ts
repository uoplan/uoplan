import type { Term } from "./dataTypes";

/**
 * Calendar-day sort key (YYYYMMDD) for the nominal first day of term, derived from
 * catalogue names like "2026 Winter Term" / "2026 Spring/Summer Term". Used only to
 * pick the next offering; not an official uOttawa date.
 */
export function approximateTermStartYyyymmdd(term: Term): number | null {
  const m = term.name.trim().match(/^(\d{4})\s+(Fall|Winter|Spring\/Summer|Spring|Summer)\b/i);
  if (!m) return null;
  const year = Number(m[1]);
  const kind = m[2].toLowerCase();
  if (!Number.isFinite(year)) return null;
  let month: number;
  if (kind === "fall") month = 9;
  else if (kind === "winter") month = 1;
  else if (kind === "spring/summer" || kind === "spring" || kind === "summer") month = 5;
  else return null;
  return year * 10000 + month * 100 + 1;
}

function calendarYyyymmdd(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * When no term is encoded in shared state, prefer the catalogue term whose nominal
 * start is the earliest date on or after `now`. If every term start is in the past,
 * use the latest nominal start (most future listing). If names cannot be parsed,
 * falls back to `terms[terms.length - 1]` then `terms[0]`.
 */
export function defaultUpcomingTermId(terms: Term[], now: Date = new Date()): string | null {
  if (terms.length === 0) return null;
  const today = calendarYyyymmdd(now);
  const annotated = terms.map((term) => ({
    term,
    start: approximateTermStartYyyymmdd(term),
  }));
  const dated = annotated.filter((x): x is { term: Term; start: number } => x.start != null);
  if (dated.length === 0) {
    return terms[terms.length - 1]?.termId ?? terms[0]?.termId ?? null;
  }
  const future = dated.filter((x) => x.start >= today).sort((a, b) => a.start - b.start);
  if (future.length > 0) return future[0].term.termId;
  const past = dated.sort((a, b) => b.start - a.start);
  return past[0].term.termId;
}
