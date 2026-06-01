import type { DataCache, RemainingRequirement } from "@uoplan/core";
import { normalizeCourseCode, getCourseCredits, isGroupToken } from "@uoplan/core";
import {
  compareReqPreference,
  type AutoAssignReqMeta,
} from "../../store/requirementCompute/autoAssign";

/**
 * Resolution of the unified "courses you want" list (advanced/transcript mode) against the
 * student's remaining requirements. Drives BOTH the sidebar warnings and the generation params,
 * so the two never diverge.
 *
 * - `assigned`: prerequisite-eligible desired courses that matched a remaining requirement, keyed
 *   by requirement id. These are unioned into `constrainedPerRequirement` at generation time so the
 *   course is pinned AND counts toward that requirement's credits.
 * - `standalone`: desired courses that must be force-pinned as their own pool — either because no
 *   remaining requirement matched, the matching requirement(s) are already full, or the
 *   prerequisites aren't met (forcing bypasses the prereq filter so the course still appears).
 *   Passed to generation as `forcedCourses`.
 * - `prereqUnmet`: subset of `standalone` whose prerequisites are not satisfied (warning copy).
 * - `noRequirement`: subset of `standalone` that is prereq-eligible but matched no requirement.
 * - `overflow`: subset of `standalone` that DID match a requirement, but every matching requirement
 *   was already at capacity, so the course can't count toward it (warning copy).
 * - `completed`: desired courses the student has already completed (won't be scheduled).
 * - `unavailable`: desired courses with no schedule offered this term (can't be scheduled).
 */
export interface DesiredCourseResolution {
  assigned: Record<string, string[]>;
  standalone: string[];
  prereqUnmet: string[];
  noRequirement: string[];
  overflow: string[];
  completed: string[];
  unavailable: string[];
}

/** Requirement types whose candidates are explicit-choice branches and never auto-assignment targets. */
const NEVER_AUTO_ASSIGN_TYPES = new Set(["or_group", "or_course", "options_group"]);

const DEFAULT_CREDITS_NEEDED = 3;
const UNCAPPED = 9999;

export function resolveDesiredCourses(
  remainingRequirements: RemainingRequirement[],
  desiredCourses: string[],
  completedCourses: string[],
  manualConstrainedPerRequirement: Record<string, string[]>,
  selectedPerRequirement: Record<string, string[]>,
  prereqEligibleCourses: string[],
  cache: DataCache | null,
): DesiredCourseResolution {
  const assigned: Record<string, string[]> = {};
  const standalone: string[] = [];
  const prereqUnmet: string[] = [];
  const noRequirement: string[] = [];
  const overflow: string[] = [];
  const completed: string[] = [];
  const unavailable: string[] = [];

  if (!cache) {
    return { assigned, standalone, prereqUnmet, noRequirement, overflow, completed, unavailable };
  }

  const completedSet = new Set(completedCourses.map((c) => cache.resolveToCanonical(c)));
  const prereqEligibleSet = new Set(prereqEligibleCourses);

  // Assignable requirement metadata (excludes explicit-choice branch types, whose candidates are
  // blocked from auto-assignment entirely).
  const metas: AutoAssignReqMeta[] = [];
  const blocked = new Set<string>();
  for (const req of remainingRequirements) {
    if (NEVER_AUTO_ASSIGN_TYPES.has(req.type)) {
      for (const candidate of req.candidateCourses ?? []) {
        blocked.add(normalizeCourseCode(candidate));
      }
      continue;
    }
    if (!req.candidateCourses?.length) continue;
    const creditsNeeded = req.creditsNeeded ?? DEFAULT_CREDITS_NEEDED;
    metas.push({
      reqId: req.requirementId,
      type: req.type,
      candidatesNorm: new Set(req.candidateCourses.map((c) => normalizeCourseCode(c))),
      creditsNeeded: creditsNeeded > 0 ? creditsNeeded : UNCAPPED,
    });
  }

  // Seed per-requirement usage from credits already committed to each requirement: the student's
  // manual constraint picks AND the courses the store auto-assigned to it (completed/locked courses
  // in `selectedPerRequirement`). The requirement panel counts both of these against the gross
  // `creditsNeeded`, so we must too — otherwise we'd overfill a requirement that's already partly
  // consumed by a completed course. Group tokens (e.g. "group:CSI") carry no fixed credit.
  const usedCreditsByReq = new Map<string, number>();
  const assignedCodesByReq = new Map<string, Set<string>>();
  const seedReqIds = new Set([
    ...Object.keys(manualConstrainedPerRequirement),
    ...Object.keys(selectedPerRequirement),
  ]);
  for (const reqId of seedReqIds) {
    let used = 0;
    const set = new Set<string>();
    const codes = [
      ...(manualConstrainedPerRequirement[reqId] ?? []),
      ...(selectedPerRequirement[reqId] ?? []),
    ];
    for (const code of codes) {
      if (isGroupToken(code)) continue;
      const norm = normalizeCourseCode(code);
      if (set.has(norm)) continue;
      used += getCourseCredits(norm, cache);
      set.add(norm);
    }
    usedCreditsByReq.set(reqId, used);
    assignedCodesByReq.set(reqId, set);
  }

  const seen = new Set<string>();
  const pending: { norm: string; code: string }[] = [];
  for (const raw of desiredCourses) {
    const norm = cache.resolveToCanonical(raw);
    if (seen.has(norm)) continue;
    seen.add(norm);
    pending.push({ norm, code: cache.getCourse(norm)?.code ?? raw });
  }

  // How many assignable requirements a course matches. Drives placement order: scarce courses are
  // placed first so a course with only one home isn't crowded out of its limited slots by a course
  // that could land in many requirements (e.g. a broad elective).
  const matchCount = (norm: string) =>
    blocked.has(norm) ? 0 : metas.reduce((n, m) => n + (m.candidatesNorm.has(norm) ? 1 : 0), 0);

  const ordered = pending
    .map((p, index) => ({ ...p, index, scarcity: matchCount(p.norm) }))
    .sort((a, b) => {
      // Courses that match at least one requirement are routed before unmatched ones; among matched
      // courses the scarcest go first; ties preserve the user's original ordering.
      const aMatched = a.scarcity > 0 ? 1 : 0;
      const bMatched = b.scarcity > 0 ? 1 : 0;
      if (aMatched !== bMatched) return bMatched - aMatched;
      if (a.scarcity !== b.scarcity) return a.scarcity - b.scarcity;
      return a.index - b.index;
    });

  for (const { norm, code } of ordered) {
    if (completedSet.has(norm)) {
      completed.push(code);
      continue;
    }
    if (!cache.getSchedule(norm) && !cache.getSchedule(code)) {
      unavailable.push(code);
      continue;
    }

    const eligible = prereqEligibleSet.has(code) || prereqEligibleSet.has(norm);
    if (!eligible) {
      // Force-pin so it still appears, bypassing the prerequisite filter; warn that the student
      // likely needs instructor permission.
      prereqUnmet.push(code);
      standalone.push(code);
      continue;
    }

    const candidates = blocked.has(norm)
      ? []
      : metas.filter((m) => m.candidatesNorm.has(norm)).sort(compareReqPreference);

    const courseCredits = getCourseCredits(norm, cache);
    let placed = false;
    for (const m of candidates) {
      const set = assignedCodesByReq.get(m.reqId) ?? new Set<string>();
      if (set.has(norm)) {
        // Already counted toward this requirement (manual pick or earlier in this pass); still
        // report it so the assignment is reflected to the user without double-counting credits.
        (assigned[m.reqId] ??= []).push(code);
        placed = true;
        break;
      }
      const used = usedCreditsByReq.get(m.reqId) ?? 0;
      if (used + courseCredits > m.creditsNeeded) continue;
      (assigned[m.reqId] ??= []).push(code);
      set.add(norm);
      assignedCodesByReq.set(m.reqId, set);
      usedCreditsByReq.set(m.reqId, used + courseCredits);
      placed = true;
      break;
    }

    if (!placed) {
      standalone.push(code);
      // Matched a requirement but every match was full → overflow; matched nothing → noRequirement.
      if (candidates.length > 0) overflow.push(code);
      else noRequirement.push(code);
    }
  }

  return { assigned, standalone, prereqUnmet, noRequirement, overflow, completed, unavailable };
}
