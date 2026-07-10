import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import type { GenerationConstraints } from "./generation";
import { getValidSectionCombos } from "./generation";
import {
  isHonoursProject,
  isTimelessCourse,
  normalizeCourseCode,
} from "@uoplan/domain/utils/courseUtils";
import { diagnoseByRelaxation } from "./engine/diagnostics/relaxation";
import type { RelaxationOutcome } from "./engine/diagnostics/relaxation";

export type TimetableFailureKind =
  | "no_section_combos"
  | "too_few_courses_with_combos"
  | "no_conflict_free_assignment";

export interface ActiveConstraintsSummary {
  maxFirstYearCredits: boolean;
}

/**
 * Machine-readable suggestion identifiers. The locale-agnostic core never emits
 * UI prose; the web layer maps each code to a translated string (see
 * `apps/web/src/lib/generationDiagnosticsText.ts`).
 */
export type SuggestionCode =
  | "relax-filters"
  | "try-different-course"
  | "turn-off-compressed"
  | "widen-hours-days"
  | "relax-fy-cap"
  | "un-blacklist"
  | "widen-or-change-picks"
  | "combined-blockers-intro"
  | "structural-conflict";

export type LeadCode =
  | "no-sections-named"
  | "no-sections"
  | "too-few-courses"
  | "no-clash-free"
  | "structural-conflict";

/** Structured description of the primary alert line, rendered by the web layer. */
export interface LeadDescriptor {
  code: LeadCode;
  /** Display course codes (already canonical) for `no-sections-named`. */
  courses?: string[];
  /** For `too-few-courses`. */
  eligible?: number;
  target?: number;
}

export interface TimetableFailureDiagnostics {
  kind: TimetableFailureKind;
  /** Courses with no schedule row or zero valid section combinations under constraints. */
  coursesWithNoCombo: string[];
  comboCountByCourse: Record<string, number>;
  eligibleCourseCount: number;
  targetCount: number;
  /** Machine-readable suggestion codes (web maps to translated strings). */
  suggestions: SuggestionCode[];
  activeConstraintsSummary: ActiveConstraintsSummary;
  /** Structured primary alert line (web maps to a translated sentence). */
  lead: LeadDescriptor;
  /**
   * For the "no_conflict_free_assignment" case, the result of bounded
   * relaxation: which specific constraint(s), if removed, would actually
   * unblock a timetable. Absent when not applicable or not computed.
   */
  relaxation?: RelaxationOutcome;
}

function canonicalDisplayCode(code: string, cache: DataCache): string {
  const normalized = normalizeCourseCode(code);
  return cache.getCourse(normalized)?.code ?? normalized;
}

/** Combo count for generation: timeless courses always schedulable (empty times); else valid section combos. */
export function countValidCombosForCourse(
  code: string,
  cache: DataCache,
  constraints?: GenerationConstraints,
): number {
  if (isTimelessCourse(code, cache)) return 1;
  const schedule = cache.getSchedule(code);
  if (!schedule) return 0;
  return getValidSectionCombos(schedule, constraints).length;
}

function buildActiveConstraintsSummary(
  constraints?: GenerationConstraints,
): ActiveConstraintsSummary {
  if (!constraints) {
    return {
      maxFirstYearCredits: false,
    };
  }
  return {
    maxFirstYearCredits: constraints.maxFirstYearCredits != null,
  };
}

function buildTimetableFailureDiagnostics(
  kind: TimetableFailureKind,
  eligibleCourseCount: number,
  targetCount: number,
  coursesWithNoCombo: string[],
  comboCountByCourse: Record<string, number>,
  activeConstraintsSummary: ActiveConstraintsSummary,
): TimetableFailureDiagnostics {
  const lead = buildLeadDescriptor(kind, eligibleCourseCount, targetCount, coursesWithNoCombo);
  return {
    kind,
    coursesWithNoCombo: [...new Set(coursesWithNoCombo)],
    comboCountByCourse,
    eligibleCourseCount,
    targetCount,
    suggestions: buildSuggestions(kind, activeConstraintsSummary, coursesWithNoCombo),
    activeConstraintsSummary,
    lead,
  };
}

const RELAX_SUGGESTION_BY_ID: Record<string, SuggestionCode> = {
  "compressed-schedule": "turn-off-compressed",
  "time-window": "widen-hours-days",
  "max-first-year-credits": "relax-fy-cap",
  blacklist: "un-blacklist",
};

/**
 * Turns a bounded-relaxation outcome into precise, *verified* suggestion codes:
 * only the constraints proven to unblock a timetable are listed, in place of the
 * legacy "list every active constraint" guesswork.
 */
function suggestionsFromRelaxation(outcome: RelaxationOutcome): SuggestionCode[] | null {
  if (outcome.kind === "single_blockers") {
    const tips = outcome.blockers
      .map((b) => RELAX_SUGGESTION_BY_ID[b.id])
      .filter((s): s is SuggestionCode => s != null);
    return tips.length > 0 ? tips : null;
  }
  if (outcome.kind === "combined_blockers") {
    const tips = outcome.relaxable
      .map((b) => RELAX_SUGGESTION_BY_ID[b.id])
      .filter((s): s is SuggestionCode => s != null);
    if (tips.length === 0) return null;
    return ["combined-blockers-intro", ...tips];
  }
  if (outcome.kind === "structural_conflict") {
    return ["structural-conflict"];
  }
  return null;
}

const MAX_SUGGESTIONS = 4;

function buildSuggestions(
  kind: TimetableFailureKind,
  summary: ActiveConstraintsSummary,
  coursesWithNoCombo: string[],
): SuggestionCode[] {
  const suggestions: SuggestionCode[] = [];

  if (kind === "no_section_combos" || kind === "too_few_courses_with_combos") {
    suggestions.push("relax-filters");
    if (coursesWithNoCombo.length > 0) {
      suggestions.push("try-different-course");
    }
  }

  if (kind === "no_conflict_free_assignment") {
    if (summary.maxFirstYearCredits) {
      suggestions.push("relax-fy-cap");
    }
    if (suggestions.length < MAX_SUGGESTIONS) {
      suggestions.push("widen-or-change-picks");
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

function buildLeadDescriptor(
  kind: TimetableFailureKind,
  eligibleCourseCount: number,
  targetCount: number,
  coursesWithNoCombo: string[],
): LeadDescriptor {
  if (kind === "no_section_combos") {
    return coursesWithNoCombo.length > 0
      ? { code: "no-sections-named", courses: [...new Set(coursesWithNoCombo)] }
      : { code: "no-sections" };
  }
  if (kind === "too_few_courses_with_combos") {
    return { code: "too-few-courses", eligible: eligibleCourseCount, target: targetCount };
  }
  return { code: "no-clash-free" };
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
  const lead: LeadDescriptor =
    relaxation.kind === "structural_conflict" ? { code: "structural-conflict" } : base.lead;

  return {
    ...base,
    relaxation,
    lead,
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
    const seen = new Set<NormalizedCourseCode>();
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

    return buildTimetableFailureDiagnostics(
      kind,
      eligibleCourseCount,
      targetCount,
      coursesWithNoCombo,
      comboCountByCourse,
      summary,
    );
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
      lead: buildLeadDescriptor(kind, eligibleCourseCount, targetCount, coursesWithNoCombo),
    };
  }

  const remainingSlots = targetCount - pinnedCourseCodes.length;
  const optionalSeen = new Set<NormalizedCourseCode>();
  const pinnedSet = new Set(pinnedCourseCodes.map(normalizeCourseCode));
  let optionalEligibleCount = 0;

  for (const code of optionalCourseCodes) {
    const key = normalizeCourseCode(code);
    if (pinnedSet.has(key)) {
      continue;
    }
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

  return buildTimetableFailureDiagnostics(
    kind,
    eligibleCourseCount,
    targetCount,
    coursesWithNoCombo,
    comboCountByCourse,
    summary,
  );
}
