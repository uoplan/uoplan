/**
 * Pure helper utilities for the Important Dates feature.
 *
 * Dependency-free: no React, no data fetching, no ICS logic. All helpers accept
 * an injected `today` string (YYYY-MM-DD) so they are deterministic under tests.
 */

import type { ImportantDateTerm } from "@uoplan/core/dataTypes";

/** Season sort order: winter first, then spring-summer, then fall. */
const SEASON_ORDER: Readonly<Record<ImportantDateTerm["season"], number>> = {
  winter: 0,
  "spring-summer": 1,
  fall: 2,
};

/**
 * Returns a chronologically sorted copy of the terms array (year ascending,
 * then winter < spring-summer < fall). Does not mutate the input.
 */
export function sortImportantDateTerms(terms: readonly ImportantDateTerm[]): ImportantDateTerm[] {
  return [...terms].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return SEASON_ORDER[a.season] - SEASON_ORDER[b.season];
  });
}

/**
 * Returns true when the term's termInterval.endDate is strictly before today
 * (i.e. the inclusive end has passed). Uses string comparison; dates must be
 * YYYY-MM-DD so lexicographic order matches chronological order.
 */
export function isTermPassed(term: ImportantDateTerm, today: string): boolean {
  return term.termInterval.endDate < today;
}

/**
 * Splits terms into two groups, given today's date:
 * - `current`:    sourcePublished === "true" AND not yet passed (the only
 *                 terms the page shows by default).
 * - `historical`: passed published terms, plus any archived term
 *                 (sourcePublished !== "true") regardless of its dates.
 *
 * Preserves input ordering within each group.
 */
export function groupTermsByPublication(
  terms: readonly ImportantDateTerm[],
  today: string,
): {
  current: ImportantDateTerm[];
  historical: ImportantDateTerm[];
} {
  const current: ImportantDateTerm[] = [];
  const historical: ImportantDateTerm[] = [];
  for (const term of terms) {
    if (term.sourcePublished === "true" && !isTermPassed(term, today)) {
      current.push(term);
    } else {
      historical.push(term);
    }
  }
  return { current, historical };
}

/** Checks whether today (YYYY-MM-DD) falls inside the given interval (inclusive). */
function containsDate(interval: { startDate: string; endDate: string }, today: string): boolean {
  return interval.startDate <= today && today <= interval.endDate;
}

/**
 * Selects the best default term given today's date:
 * 1. A term whose courseInterval contains today (prefer active teaching period).
 * 2. A term whose termInterval contains today (broader administrative window).
 * 3. The nearest future term (smallest termInterval.startDate > today).
 * 4. The latest term in the sorted list (all terms are in the past).
 *
 * Returns null for an empty terms array.
 */
export function selectDefaultTerm(
  terms: readonly ImportantDateTerm[],
  today: string,
): ImportantDateTerm | null {
  if (terms.length === 0) return null;

  // 1. courseInterval contains today
  const inCourse = terms.find((t) => containsDate(t.courseInterval, today));
  if (inCourse) return inCourse;

  // 2. termInterval contains today
  const inTerm = terms.find((t) => containsDate(t.termInterval, today));
  if (inTerm) return inTerm;

  // 3. nearest future term
  const futureTerms = terms.filter((t) => t.termInterval.startDate > today);
  if (futureTerms.length > 0) {
    return futureTerms.reduce((nearest, t) =>
      t.termInterval.startDate < nearest.termInterval.startDate ? t : nearest,
    );
  }

  // 4. latest term (last in sorted order; caller should pass a sorted list but
  //    we fall back gracefully by scanning for the max)
  return terms.reduce((latest, t) =>
    t.termInterval.endDate > latest.termInterval.endDate ? t : latest,
  );
}

/**
 * Returns today's date as a YYYY-MM-DD string using the America/Toronto timezone.
 * Uses `Intl.DateTimeFormat` for deterministic timezone conversion.
 */
export function todayInToronto(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
