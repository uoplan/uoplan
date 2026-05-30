import type { DataCache } from "./dataCache";
import type { GenerationConstraints } from "./generation";
import { getValidSectionCombos } from "./generation";
import { isHonoursProject, normalizeCourseCode } from "./utils/courseUtils";
import { diagnoseByRelaxation, type RelaxationOutcome } from "./engine/diagnostics/relaxation";

export type TimetableFailureKind =
  | "no_section_combos"
  | "too_few_courses_with_combos"
  | "no_conflict_free_assignment";

export interface ActiveConstraintsSummary {
  compressedSchedule: boolean;
  minProfessorRating: boolean;
  /** User narrowed allowed days (non-empty selection). */
  allowedDaysCustom: boolean;
  maxFirstYearCredits: boolean;
}

export interface TimetableFailureDiagnostics {
  kind: TimetableFailureKind;
  /** Courses with no schedule row or zero valid section combinations under constraints. */
  coursesWithNoCombo: string[];
  comboCountByCourse: Record<string, number>;
  eligibleCourseCount: number;
  targetCount: number;
  suggestions: string[];
  activeConstraintsSummary: ActiveConstraintsSummary;
  /** One short sentence for a primary alert line. */
  leadMessage: string;
  /**
   * For the "no_conflict_free_assignment" case, the result of bounded
   * relaxation: which specific constraint(s), if removed, would actually
   * unblock a timetable. Absent when not applicable or not computed.
   */
  relaxation?: RelaxationOutcome;
}

function canonicalDisplayCode(code: string, cache: DataCache): string {
  return cache.getCourse(normalizeCourseCode(code))?.code ?? code;
}

/** Combo count for generation: honours always schedulable (empty times); else valid section combos. */
export function countValidCombosForCourse(
  code: string,
  cache: DataCache,
  constraints?: GenerationConstraints,
): number {
  if (isHonoursProject(code, cache)) return 1;
  const schedule = cache.getSchedule(code);
  if (!schedule) return 0;
  return getValidSectionCombos(schedule, constraints).length;
}

function buildActiveConstraintsSummary(
  constraints?: GenerationConstraints,
): ActiveConstraintsSummary {
  if (!constraints) {
    return {
      compressedSchedule: false,
      minProfessorRating: false,
      allowedDaysCustom: false,
      maxFirstYearCredits: false,
    };
  }
  return {
    compressedSchedule: !!constraints.compressedSchedule,
    minProfessorRating:
      constraints.minProfessorRating != null && constraints.minProfessorRating > 0,
    allowedDaysCustom: constraints.allowedDays.length > 0,
    maxFirstYearCredits: constraints.maxFirstYearCredits != null,
  };
}

const RELAX_SUGGESTION_BY_ID: Record<string, string> = {
  "compressed-schedule": "Turn off Compressed schedule.",
  "min-professor-rating": "Clear minimum professor rating.",
  "time-window": "Widen class hours or allow more weekdays.",
  "max-first-year-credits": "Relax the 1000-level credit cap if possible.",
  blacklist: "Un-blacklist a course you removed earlier.",
};

/**
 * Turns a bounded-relaxation outcome into precise, *verified* suggestions: only
 * the constraints proven to unblock a timetable are listed, in place of the
 * legacy "list every active constraint" guesswork.
 */
function suggestionsFromRelaxation(outcome: RelaxationOutcome): string[] | null {
  if (outcome.kind === "single_blockers") {
    const tips = outcome.blockers
      .map((b) => RELAX_SUGGESTION_BY_ID[b.id])
      .filter((s): s is string => s != null);
    return tips.length > 0 ? tips : null;
  }
  if (outcome.kind === "combined_blockers") {
    const tips = outcome.relaxable
      .map((b) => RELAX_SUGGESTION_BY_ID[b.id])
      .filter((s): s is string => s != null);
    if (tips.length === 0) return null;
    return ["No single filter is the culprit — relaxing several together helps:", ...tips];
  }
  if (outcome.kind === "structural_conflict") {
    return [
      "These courses can't all fit in one timetable, even with filters off. " +
        "Try different Constrain / Assign picks or fewer courses.",
    ];
  }
  return null;
}

const MAX_SUGGESTIONS = 4;

function buildSuggestions(
  kind: TimetableFailureKind,
  summary: ActiveConstraintsSummary,
  coursesWithNoCombo: string[],
): string[] {
  const suggestions: string[] = [];

  if (kind === "no_section_combos" || kind === "too_few_courses_with_combos") {
    suggestions.push("Relax time window, professor rating, or allowed days.");
    if (coursesWithNoCombo.length > 0) {
      suggestions.push("No timetable posted yet? Try a different course or check back later.");
    }
  }

  if (kind === "no_conflict_free_assignment") {
    if (summary.compressedSchedule) {
      suggestions.push("Turn off Compressed schedule.");
    }
    if (summary.minProfessorRating) {
      suggestions.push("Clear minimum professor rating.");
    }
    if (summary.allowedDaysCustom) {
      suggestions.push("Allow more weekdays.");
    }
    if (summary.maxFirstYearCredits) {
      suggestions.push("Relax 1000-level credit cap if possible.");
    }
    if (suggestions.length < MAX_SUGGESTIONS) {
      suggestions.push("Widen class hours or change Constrain / Assign picks.");
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

function formatCourseListForLead(codes: string[]): string {
  const max = 4;
  if (codes.length <= max) return codes.join(", ");
  return `${codes.slice(0, max).join(", ")} +${codes.length - max} more`;
}

function buildLeadMessage(
  kind: TimetableFailureKind,
  eligibleCourseCount: number,
  targetCount: number,
  coursesWithNoCombo: string[],
): string {
  if (kind === "no_section_combos") {
    return coursesWithNoCombo.length > 0
      ? `No sections match your filters: ${formatCourseListForLead(coursesWithNoCombo)}.`
      : "No sections match your current filters.";
  }
  if (kind === "too_few_courses_with_combos") {
    return `Only ${eligibleCourseCount}/${targetCount} courses have valid sections.`;
  }
  return "No clash-free timetable with your current settings.";
}

export interface DiagnoseTimetableFailureInput {
  pinnedCourseCodes: string[];
  optionalCourseCodes: string[];
  targetCount: number;
  cache: DataCache;
  constraints?: GenerationConstraints;
}

/**
 * Explains why schedule generation may have returned no results, using the same
 * eligibility rules as the generation entry points (`generateBasicSchedule` /
 * `generateAdvancedSchedule`).
 *
 * For the "no clash-free timetable" case it additionally runs bounded relaxation
 * (removing one constraint at a time) to pinpoint the actual blocking
 * constraint(s) and produce verified, specific suggestions.
 */
export function diagnoseTimetableFailure(
  input: DiagnoseTimetableFailureInput,
): TimetableFailureDiagnostics {
  const base = diagnoseTimetableFailureBase(input);
  if (base.kind !== "no_conflict_free_assignment" || !input.constraints) {
    return base;
  }

  const relaxation = diagnoseByRelaxation({
    pinned: input.pinnedCourseCodes,
    optional: input.optionalCourseCodes,
    targetCount: input.targetCount,
    cache: input.cache,
    constraints: input.constraints,
  });

  if (relaxation.kind === "schedulable") {
    // Relaxation found a timetable the legacy pass missed; keep generic output.
    return { ...base, relaxation };
  }

  const tailored = suggestionsFromRelaxation(relaxation);
  const leadMessage =
    relaxation.kind === "structural_conflict"
      ? "These courses can't be scheduled together, even with all filters off."
      : base.leadMessage;

  return {
    ...base,
    relaxation,
    leadMessage,
    suggestions: (tailored ?? base.suggestions).slice(0, MAX_SUGGESTIONS),
  };
}

function diagnoseTimetableFailureBase(
  input: DiagnoseTimetableFailureInput,
): TimetableFailureDiagnostics {
  const { pinnedCourseCodes, optionalCourseCodes, targetCount, cache, constraints } = input;
  const summary = buildActiveConstraintsSummary(constraints);

  const comboCountByCourse: Record<string, number> = {};
  const coursesWithNoCombo: string[] = [];

  const recordCombo = (code: string): number => {
    const display = canonicalDisplayCode(code, cache);
    const n = countValidCombosForCourse(code, cache, constraints);
    comboCountByCourse[display] = n;
    return n;
  };

  if (pinnedCourseCodes.length === 0) {
    const seen = new Set<string>();
    let eligibleCourseCount = 0;
    for (const code of optionalCourseCodes) {
      const key = normalizeCourseCode(code);
      if (seen.has(key)) continue;
      seen.add(key);

      if (isHonoursProject(code, cache)) {
        recordCombo(code);
        eligibleCourseCount++;
        continue;
      }
      const n = recordCombo(code);
      if (n > 0) eligibleCourseCount++;
      else coursesWithNoCombo.push(canonicalDisplayCode(code, cache));
    }

    let kind: TimetableFailureKind;
    if (eligibleCourseCount < targetCount) {
      kind = eligibleCourseCount === 0 ? "no_section_combos" : "too_few_courses_with_combos";
    } else {
      kind = "no_conflict_free_assignment";
    }

    const leadMessage = buildLeadMessage(
      kind,
      eligibleCourseCount,
      targetCount,
      coursesWithNoCombo,
    );
    return {
      kind,
      coursesWithNoCombo: [...new Set(coursesWithNoCombo)],
      comboCountByCourse,
      eligibleCourseCount,
      targetCount,
      suggestions: buildSuggestions(kind, summary, coursesWithNoCombo),
      activeConstraintsSummary: summary,
      leadMessage,
    };
  }

  for (const code of pinnedCourseCodes) {
    if (isHonoursProject(code, cache)) {
      recordCombo(code);
      continue;
    }
    const n = recordCombo(code);
    if (n === 0) coursesWithNoCombo.push(canonicalDisplayCode(code, cache));
  }

  if (coursesWithNoCombo.length > 0) {
    const kind: TimetableFailureKind = "no_section_combos";
    const eligibleCourseCount = 0;
    return {
      kind,
      coursesWithNoCombo: [...new Set(coursesWithNoCombo)],
      comboCountByCourse,
      eligibleCourseCount,
      targetCount,
      suggestions: buildSuggestions(kind, summary, coursesWithNoCombo),
      activeConstraintsSummary: summary,
      leadMessage: buildLeadMessage(kind, eligibleCourseCount, targetCount, coursesWithNoCombo),
    };
  }

  const remainingSlots = targetCount - pinnedCourseCodes.length;
  const optionalSeen = new Set<string>();
  let optionalEligibleCount = 0;

  for (const code of optionalCourseCodes) {
    if (pinnedCourseCodes.some((p) => normalizeCourseCode(p) === normalizeCourseCode(code))) {
      continue;
    }
    const key = normalizeCourseCode(code);
    if (optionalSeen.has(key)) continue;
    optionalSeen.add(key);

    if (isHonoursProject(code, cache)) {
      recordCombo(code);
      optionalEligibleCount++;
      continue;
    }
    const n = recordCombo(code);
    if (n > 0) optionalEligibleCount++;
    else coursesWithNoCombo.push(canonicalDisplayCode(code, cache));
  }

  let kind: TimetableFailureKind;
  if (remainingSlots > 0 && optionalEligibleCount < remainingSlots) {
    kind = optionalEligibleCount === 0 ? "no_section_combos" : "too_few_courses_with_combos";
  } else {
    kind = "no_conflict_free_assignment";
  }

  const eligibleCourseCount = pinnedCourseCodes.length + optionalEligibleCount;
  const leadMessage = buildLeadMessage(kind, eligibleCourseCount, targetCount, coursesWithNoCombo);

  return {
    kind,
    coursesWithNoCombo: [...new Set(coursesWithNoCombo)],
    comboCountByCourse,
    eligibleCourseCount,
    targetCount,
    suggestions: buildSuggestions(kind, summary, coursesWithNoCombo),
    activeConstraintsSummary: summary,
    leadMessage,
  };
}
