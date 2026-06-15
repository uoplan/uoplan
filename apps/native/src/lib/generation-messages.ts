/**
 * Friendly schedule-generation failure messages for native.
 *
 * The locale-agnostic core emits structured diagnostics
 * ({@link diagnoseTimetableFailure} → {@link TimetableFailureDiagnostics}); this
 * thin formatter maps those machine-readable codes to translated sentences via
 * the SHARED `@uoplan/i18n` catalog (the same `gen.lead.*` / `gen.suggest.*`
 * keys the web app uses in `apps/web/src/lib/generationDiagnosticsText.ts`).
 *
 * Only the code→key mapping is mirrored here — no translation strings are
 * duplicated; every sentence resolves from the single shared PO catalog.
 */
import type {
  LeadDescriptor,
  SuggestionCode,
  TimetableFailureDiagnostics,
} from "@uoplan/core/generationDiagnostics";

import { tr } from "@/i18n";

/** How many course codes to show in a lead line before collapsing to "+N more". */
const LEAD_COURSE_PREVIEW = 4;

/** Joins canonical course codes for a lead line, collapsing the tail to "+N more". */
function formatLeadCourses(codes: string[]): string {
  if (codes.length <= LEAD_COURSE_PREVIEW) return codes.join(", ");
  const shown = codes.slice(0, LEAD_COURSE_PREVIEW).join(", ");
  return tr("gen.lead.coursesMore", {
    shown,
    count: codes.length - LEAD_COURSE_PREVIEW,
  });
}

/** Maps a structured lead descriptor to a translated primary headline sentence. */
export function formatGenerationLead(lead: LeadDescriptor): string {
  switch (lead.code) {
    case "no-sections-named":
      return tr("gen.lead.noSectionsNamed", { courses: formatLeadCourses(lead.courses ?? []) });
    case "no-sections":
      return tr("gen.lead.noSections");
    case "too-few-courses":
      return tr("gen.lead.tooFew", { eligible: lead.eligible ?? 0, target: lead.target ?? 0 });
    case "structural-conflict":
      return tr("gen.lead.structural");
    case "no-clash-free":
    default:
      return tr("gen.lead.noClashFree");
  }
}

const SUGGESTION_KEY: Record<SuggestionCode, string> = {
  "relax-filters": "gen.suggest.relaxFilters",
  "try-different-course": "gen.suggest.tryDifferentCourse",
  "turn-off-compressed": "gen.suggest.turnOffCompressed",
  "clear-min-rating": "gen.suggest.clearMinRating",
  "widen-hours-days": "gen.suggest.widenHoursDays",
  "relax-fy-cap": "gen.suggest.relaxFyCap",
  "un-blacklist": "gen.suggest.unBlacklist",
  "widen-or-change-picks": "gen.suggest.widenOrChangePicks",
  "combined-blockers-intro": "gen.suggest.combinedBlockersIntro",
  "structural-conflict": "gen.suggest.structural",
};

/** Maps a suggestion code to its translated quick-fix string. */
export function formatSuggestion(code: SuggestionCode): string {
  return tr(SUGGESTION_KEY[code]);
}

/** Translated quick-fix strings for a timetable failure, in order. */
export function formatSuggestions(tf: TimetableFailureDiagnostics): string[] {
  return tf.suggestions.map(formatSuggestion);
}
