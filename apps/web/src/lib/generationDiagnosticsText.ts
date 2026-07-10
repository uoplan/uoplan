import type { LeadDescriptor, SuggestionCode, TimetableFailureDiagnostics } from "@uoplan/core";
import type { FilterHintDescriptor, GenerationMessageDescriptor } from "@uoplan/store/types";
import { tr } from "../i18n";

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

/** Maps a structured lead descriptor to a translated primary alert sentence. */
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

/** Maps the structured generation-error headline to a translated sentence. */
export function formatGenerationMessage(message: GenerationMessageDescriptor): string {
  switch (message.kind) {
    case "lead":
      return formatGenerationLead(message.lead);
    case "complete-assign":
      return tr("gen.error.completeAssign");
    case "not-enough-courses":
      return tr("gen.error.notEnoughCourses");
    case "timeout":
      return tr("gen.error.timeout");
    case "unassigned-completed": {
      const suffix =
        message.overflow > 0 ? tr("gen.error.coursesMore", { count: message.overflow }) : "";
      return tr("gen.error.unassignedCompleted", {
        count: message.count,
        courses: `${message.preview.join(", ")}${suffix}`,
      });
    }
    default:
      return tr("gen.modal.title");
  }
}

/**
 * Short, toast-safe variant of {@link formatGenerationMessage}. Long branches
 * (currently `unassigned-completed`, which inlines a course list) collapse to a
 * one-line headline; the full message + details are shown in the error modal.
 */
export function formatGenerationToastTitle(message: GenerationMessageDescriptor): string {
  if (message.kind === "unassigned-completed") {
    return tr("gen.error.unassignedCompletedShort", { count: message.count });
  }
  return formatGenerationMessage(message);
}

const DAY_SHORT_KEY: Record<string, string> = {
  Mo: "gen.day.mon",
  Tu: "gen.day.tue",
  We: "gen.day.wed",
  Th: "gen.day.thu",
  Fr: "gen.day.fri",
  Sa: "gen.day.sat",
  Su: "gen.day.sun",
};

const LANG_KEY: Record<string, string> = {
  en: "gen.lang.english",
  fr: "gen.lang.french",
  other: "gen.lang.other",
};

function formatDays(days: string[]): string {
  return days.map((d) => (DAY_SHORT_KEY[d] ? tr(DAY_SHORT_KEY[d]) : d)).join(", ");
}

function formatLangs(langs: string[]): string {
  return langs.map((l) => (LANG_KEY[l] ? tr(LANG_KEY[l]) : l)).join(", ");
}

/** Maps a structured active-filter hint to its translated description. */
export function formatFilterHint(hint: FilterHintDescriptor): string {
  switch (hint.code) {
    case "start-after":
      return tr("gen.hint.startAfter", { time: hint.time });
    case "end-before":
      return tr("gen.hint.endBefore", { time: hint.time });
    case "days-excluded":
      return tr("gen.hint.daysExcluded", { days: formatDays(hint.days) });
    case "virtual-only":
      return tr("gen.hint.virtualOnly");
    case "closed-excluded":
      return tr("gen.hint.closedExcluded");
    case "language-filter":
      return tr("gen.hint.languageFilter", { langs: formatLangs(hint.langs) });
    default:
      return "";
  }
}
