import type { DataCache } from "@uoplan/domain/dataCache";
import type { Program, ProgramRequirement } from "@uoplan/domain/dataTypes";
import type {
  RemainingRequirement,
  RequirementWithStatus,
} from "@uoplan/requirements/requirements/types";
import { getCourseCredits, normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";

export function getAutoSelectedForRequirements(
  remaining: RemainingRequirement[],
  existing: Record<string, string[]>,
  cache: DataCache | null,
): Record<string, string[]> {
  if (!cache) {
    return {};
  }

  const out: Record<string, string[]> = {};
  for (const req of remaining) {
    const allCandidatesSet = new Set(req.candidateCourses);
    const prev = existing[req.requirementId] ?? [];
    const valid = prev.filter((c) => allCandidatesSet.has(c));
    if (valid.length > 0) out[req.requirementId] = valid;
  }

  return out;
}

const TYPE_PRIORITY: Record<string, number> = {
  course: 0,
  discipline_elective: 1,
  pick: 1,
  group: 1,
  faculty_elective: 2,
  non_discipline_elective: 3,
  free_elective: 4,
  elective: 4,
};

/** Branch / explicit-choice requirements: candidates are blocked from auto-assignment elsewhere. */
const NEVER_AUTO_ASSIGN_TYPES = new Set(["or_group", "or_course", "options_group"]);

export interface AutoAssignReqMeta {
  reqId: string;
  type: string;
  candidatesNorm: Set<string>;
  creditsNeeded: number;
}

function isStrictSubset<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size >= b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function compareReqPreference(a: AutoAssignReqMeta, b: AutoAssignReqMeta): number {
  const pa = TYPE_PRIORITY[a.type] ?? 999;
  const pb = TYPE_PRIORITY[b.type] ?? 999;
  if (pa !== pb) return pa - pb;
  const setA = a.candidatesNorm;
  const setB = b.candidatesNorm;
  const aSubB = isStrictSubset(setA, setB);
  const bSubA = isStrictSubset(setB, setA);
  if (aSubB !== bSubA) return aSubB ? -1 : 1;
  if (setA.size !== setB.size) return setA.size - setB.size;
  return a.reqId.localeCompare(b.reqId);
}

function sumCreditsForCodes(cache: DataCache, codes: string[]): number {
  let s = 0;
  for (const code of codes) {
    s += getCourseCredits(normalizeCourseCode(code), cache);
  }
  return s;
}

export function getAutoSelectedSingleEligibleCompleted(
  augmentedRemaining: RemainingRequirement[],
  unassignedCompleted: string[],
  cache: DataCache,
  alreadySelected: Record<string, string[]>,
  requirementSlotsUserTouched: Record<string, true>,
): Record<string, string[]> {
  const blockedCourses = new Set<string>();
  const metas: AutoAssignReqMeta[] = [];

  for (const req of augmentedRemaining) {
    if (NEVER_AUTO_ASSIGN_TYPES.has(req.type)) {
      for (const candidate of req.candidateCourses) {
        blockedCourses.add(normalizeCourseCode(candidate));
      }
      continue;
    }
    const tier = TYPE_PRIORITY[req.type];
    if (tier === undefined || !req.candidateCourses?.length) continue;

    const candidatesNorm = new Set(req.candidateCourses.map((c) => normalizeCourseCode(c)));
    const creditsNeeded = req.creditsNeeded ?? 3;
    metas.push({
      reqId: req.requirementId,
      type: req.type,
      candidatesNorm,
      creditsNeeded: creditsNeeded > 0 ? creditsNeeded : 9999,
    });
  }

  function eligibleMetasForCourse(norm: string): AutoAssignReqMeta[] {
    if (blockedCourses.has(norm)) return [];
    const list: AutoAssignReqMeta[] = [];
    for (const m of metas) {
      if (!m.candidatesNorm.has(norm)) continue;
      if (m.reqId in requirementSlotsUserTouched) continue;
      list.push(m);
    }
    list.sort(compareReqPreference);
    return list;
  }

  const coursesSorted = [...unassignedCompleted].sort((a, b) => {
    const na = eligibleMetasForCourse(a).length;
    const nb = eligibleMetasForCourse(b).length;
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });

  const out: Record<string, string[]> = {};

  for (const norm of coursesSorted) {
    if (blockedCourses.has(norm)) continue;

    const courseCredits = getCourseCredits(norm, cache);
    const courseCode = cache.getCourse(norm)?.code ?? norm;

    const candidates = eligibleMetasForCourse(norm);

    for (const m of candidates) {
      const existingForReq = [...(alreadySelected[m.reqId] ?? []), ...(out[m.reqId] ?? [])];
      if (existingForReq.includes(courseCode)) {
        break;
      }

      const used = sumCreditsForCodes(cache, existingForReq);
      const cap = m.creditsNeeded;
      if (used + courseCredits > cap) continue;

      out[m.reqId] = [...existingForReq, courseCode];
      break;
    }
  }

  return out;
}

/** Group-style requirement types whose candidate lists are augmented + auto-filled. */
const AUTO_ASSIGN_GROUP_STYLE_TYPES = [
  "group",
  "pick",
  "elective",
  "discipline_elective",
  "faculty_elective",
  "free_elective",
  "non_discipline_elective",
] as const;

/**
 * Course codes pinned to exact `course` / `or_course` requirement slots by the
 * requirement evaluator (its `satisfiedBy` output, already canonical).
 */
export function collectAssignedFromExactRequirements(tree: RequirementWithStatus[]): Set<string> {
  const assigned = new Set<string>();
  const walk = (nodes: RequirementWithStatus[]): void => {
    for (const node of nodes) {
      if ((node.type === "course" || node.type === "or_course") && node.satisfiedBy?.length) {
        for (const code of node.satisfiedBy) assigned.add(normalizeCourseCode(code));
      }
      if (node.options?.length) walk(node.options);
    }
  };
  walk(tree);
  return assigned;
}

/** Distinct subject prefixes referenced by a program's explicit `course` requirements. */
export function getDisciplineCodesForProgram(program: Program | null): string[] {
  const codes = new Set<string>();
  if (!program) return [];

  const walk = (node: ProgramRequirement): void => {
    if (!node) return;
    if (node.type === "course" && node.code) {
      const match = node.code.match(/^([a-zA-Z]+)\s/);
      if (match) codes.add(match[1]!.toUpperCase());
    }
    if (node.options) {
      for (const option of node.options) walk(option);
    }
  };

  for (const requirement of program.requirements) walk(requirement);
  return [...codes];
}

export interface RequirementAutoAssignmentInput {
  /** Outstanding requirement blocks from the evaluator. */
  remaining: RemainingRequirement[];
  /** Full requirement tree with status (for exact-slot detection). */
  tree: RequirementWithStatus[];
  /** The student's completed-course basket. */
  completedCourses: readonly string[];
  cache: DataCache;
  /** Persisted requirement → course-code selections. */
  selectedPerRequirement: Record<string, string[]>;
  /** Requirement slots the student manually edited (locked from auto-assignment). */
  requirementSlotsUserTouched: Record<string, true>;
}

export interface RequirementAutoAssignment {
  /** Group-style requirements with unassigned-completed candidates surfaced first. */
  augmentedRemaining: RemainingRequirement[];
  /** User-locked + auto-selected + auto-completed selections, merged. */
  selectedPerRequirement: Record<string, string[]>;
  /** Completed courses still eligible for a remaining requirement but left unplaced (display codes). */
  unassignedCompletedCourses: string[];
  /** How many completed courses the greedy pass auto-placed on the student's behalf. */
  autoAssignedCount: number;
}

/**
 * Greedily auto-assign completed courses to the outstanding requirements,
 * mirroring the web planner's `recomputeStateForProgram`. Completed courses are
 * resolved to their canonical code via {@link DataCache.resolveToCanonical} (so a
 * renumbered course such as `MAT 2377` → `STA 2391` matches a requirement listed
 * under either code); slots the student manually touched are never overwritten;
 * and group-style candidate lists surface eligible completed courses first.
 *
 * Shared by the web store and the native planner so both platforms compute
 * requirement satisfaction identically.
 */
export function computeRequirementAutoAssignment(
  input: RequirementAutoAssignmentInput,
): RequirementAutoAssignment {
  const { remaining, tree, completedCourses, cache, requirementSlotsUserTouched } = input;

  const userLocked: Record<string, string[]> = {};
  for (const [reqId, codes] of Object.entries(input.selectedPerRequirement)) {
    if (requirementSlotsUserTouched[reqId]) userLocked[reqId] = codes;
  }

  const autoSelected = getAutoSelectedForRequirements(remaining, userLocked, cache);

  // Unassigned completed = completed minus exact-match slots minus user-touched slots.
  const assignedFromExact = collectAssignedFromExactRequirements(tree);
  const assignedFromUser = new Set<string>();
  for (const [reqId, codes] of Object.entries(input.selectedPerRequirement)) {
    if (!requirementSlotsUserTouched[reqId]) continue;
    for (const code of codes) assignedFromUser.add(normalizeCourseCode(code));
  }

  const isWorkTerm = (norm: string): boolean => {
    const component = cache.getCourse(norm)?.component?.trim().toLowerCase() ?? "";
    return component.startsWith("stage / work term");
  };

  // Canonicalise completed courses so renumbered/aliased codes match requirement codes.
  const completedCanonical = new Set(
    completedCourses.map((code) => cache.resolveToCanonical(code)),
  );
  const unassignedCompleted = [...completedCanonical].filter(
    (norm) => !assignedFromExact.has(norm) && !assignedFromUser.has(norm) && !isWorkTerm(norm),
  );

  // For group-style requirements, surface unassigned completed (eligible) candidates first.
  const augmentedRemaining = remaining.map((req) => {
    if (
      !req.candidateCourses?.length ||
      !AUTO_ASSIGN_GROUP_STYLE_TYPES.includes(
        req.type as (typeof AUTO_ASSIGN_GROUP_STYLE_TYPES)[number],
      )
    ) {
      return req;
    }
    const eligibleSet = new Set(req.candidateCourses.map((code) => normalizeCourseCode(code)));
    const unassignedEligible = unassignedCompleted.filter((norm) => eligibleSet.has(norm));
    const displayCodes = unassignedEligible.map((norm) => cache.getCourse(norm)?.code ?? norm);
    const candidateCourses = [...new Set([...displayCodes, ...req.candidateCourses])];
    return { ...req, candidateCourses };
  });

  const autoSelectedCompleted = getAutoSelectedSingleEligibleCompleted(
    augmentedRemaining,
    unassignedCompleted,
    cache,
    { ...userLocked, ...autoSelected },
    requirementSlotsUserTouched,
  );

  const selectedPerRequirement = {
    ...userLocked,
    ...autoSelected,
    ...autoSelectedCompleted,
  };

  // Recompute unassigned against the merged selections so the readout is immediately accurate.
  const finalAssigned = new Set<string>();
  for (const codes of Object.values(selectedPerRequirement)) {
    for (const code of codes) finalAssigned.add(normalizeCourseCode(code));
  }
  const unassignedCompletedCourses = unassignedCompleted
    .filter((norm) => !finalAssigned.has(norm))
    .map((norm) => cache.getCourse(norm)?.code ?? norm);

  const autoAssignedCount = unassignedCompleted.length - unassignedCompletedCourses.length;

  return {
    augmentedRemaining,
    selectedPerRequirement,
    unassignedCompletedCourses,
    autoAssignedCount,
  };
}
