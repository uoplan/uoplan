// Important-dates parser entry point: turns the English + French uOttawa
// important-dates HTML pages into the paired ImportantDatesData structures.
//
// Implementation is split across cohesive siblings:
//   parseTypes.ts     — shared Localized*/Canonical* types
//   parseText.ts      — text normalization + error/context helpers
//   parseExtract.ts   — HTML → LocalizedPage extraction
//   parseCanonical.ts — LocalizedTerm → CanonicalTerm (dates, identity, categories)
//   parseSessions.ts  — named-session extraction/validation
//   parseLocalized.ts — French-onto-canonical structural merge

import type { ImportantDatesData, ImportantDateTerm } from "@uoplan/core/dataTypes";
import type { ParseImportantDatesPagesInput } from "./parseTypes.ts";
import { extractLocalizedPage } from "./parseExtract.ts";
import {
  buildCanonicalTerm,
  compareTermsChronologically,
  validateUniqueCanonicalIds,
} from "./parseCanonical.ts";
import { buildLocalizedTerm } from "./parseLocalized.ts";

export function parseImportantDatesPages(input: ParseImportantDatesPagesInput): {
  en: ImportantDatesData;
  fr: ImportantDatesData;
} {
  const englishPage = extractLocalizedPage({
    html: input.enHtml,
    locale: "en",
    sourceUrl: input.enSourceUrl,
  });
  const frenchPage = extractLocalizedPage({
    html: input.frHtml,
    locale: "fr",
    sourceUrl: input.frSourceUrl,
  });

  const canonicalTerms = englishPage.terms
    .map((term) => buildCanonicalTerm(term, englishPage.sourceUrl))
    .sort(compareTermsChronologically);

  validateUniqueCanonicalIds(canonicalTerms, englishPage.sourceUrl);

  const frenchTermsBySourceId = new Map(frenchPage.terms.map((term) => [term.sourceId, term]));
  const matchedFrenchIds = new Set<string>();

  const englishTerms: ImportantDateTerm[] = [];
  const frenchTerms: ImportantDateTerm[] = [];

  for (const canonicalTerm of canonicalTerms) {
    const localizedFrenchTerm = frenchTermsBySourceId.get(canonicalTerm.sourceId);
    if (!localizedFrenchTerm) {
      throw new Error(
        `Missing French term for sourceId=${canonicalTerm.sourceId} at ${frenchPage.sourceUrl}`,
      );
    }
    matchedFrenchIds.add(canonicalTerm.sourceId);

    englishTerms.push({
      sourceId: canonicalTerm.sourceId,
      termId: canonicalTerm.termId,
      label: canonicalTerm.label,
      season: canonicalTerm.season,
      year: canonicalTerm.year,
      sourcePublished: canonicalTerm.sourcePublished,
      termInterval: canonicalTerm.termInterval,
      courseInterval: canonicalTerm.courseInterval,
      sections: canonicalTerm.sections,
      sessions: canonicalTerm.sessions,
    });

    frenchTerms.push(
      buildLocalizedTerm({
        canonicalTerm,
        localizedTerm: localizedFrenchTerm,
        localizedPage: frenchPage,
      }),
    );
  }

  for (const frenchTerm of frenchPage.terms) {
    if (!matchedFrenchIds.has(frenchTerm.sourceId)) {
      throw new Error(
        `Unexpected French term without English match for sourceId=${frenchTerm.sourceId} at ${frenchPage.sourceUrl}`,
      );
    }
  }

  return {
    en: {
      locale: "en",
      sourceUrl: englishPage.sourceUrl,
      ...(englishPage.reviewedText ? { reviewedText: englishPage.reviewedText } : {}),
      terms: englishTerms,
    },
    fr: {
      locale: "fr-CA",
      sourceUrl: frenchPage.sourceUrl,
      ...(frenchPage.reviewedText ? { reviewedText: frenchPage.reviewedText } : {}),
      terms: frenchTerms,
    },
  };
}
