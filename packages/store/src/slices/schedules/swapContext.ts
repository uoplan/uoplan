import type { AppStore } from "../../types";
import type { GenerationConstraints } from "@uoplan/core";
import { normalizeCourseCode, virtualScheduleFilterApplies } from "@uoplan/core";

/**
 * The set of explicitly user-pinned course codes (normalized) that are exempt
 * from the virtual-section filter. Built from both the constrained and selected
 * per-requirement maps. Shared by every swap path (live action, replay, and the
 * candidate listing) so the exemption rule lives in one place.
 */
export function buildExplicitExemptSet(
  constrainedPerRequirement: Record<string, string[]>,
  selectedPerRequirement: Record<string, string[]>,
): Set<string> {
  const exempt = new Set<string>();
  for (const codes of Object.values(constrainedPerRequirement)) {
    for (const code of codes) exempt.add(normalizeCourseCode(code));
  }
  for (const codes of Object.values(selectedPerRequirement)) {
    for (const code of codes) exempt.add(normalizeCourseCode(code));
  }
  return exempt;
}

/**
 * Whether a course being swapped in should be restricted to virtual sections.
 * Basic mode applies the global flag verbatim; advanced mode defers to
 * {@link virtualScheduleFilterApplies} using the target requirement's type.
 */
export function resolveSwapVirtualOnly(
  calendarMode: AppStore["calendarMode"],
  virtualSectionsOnly: boolean,
  reqType: string | undefined,
  newCourseCode: string,
  exempt: Set<string>,
): boolean {
  if (calendarMode === "basic") return virtualSectionsOnly;
  return virtualScheduleFilterApplies(virtualSectionsOnly, reqType, newCourseCode, exempt);
}

/**
 * Carry the swapped-out course's requirement-pool assignment over to the
 * swapped-in course. Returns the original map unchanged when there is no pool id
 * to transfer.
 */
export function transferPoolEntry(
  poolMap: Record<string, string>,
  oldCode: string,
  newCode: string,
  fallbackReqId: string | undefined,
): Record<string, string> {
  const poolId = poolMap[oldCode] ?? fallbackReqId;
  return poolId != null ? { ...poolMap, [newCode]: poolId } : poolMap;
}

/** Build the {@link GenerationConstraints} used by every swap feasibility check. */
export function buildSwapConstraints(state: AppStore): GenerationConstraints {
  return {
    minStartMinutes: state.generationMinStartMinutes,
    maxEndMinutes: state.generationMaxEndMinutes,
    generationPreferHigherProfessorRating: state.generationPreferHigherProfessorRating,
    professorRatings: state.professorRatings ?? undefined,
    blockedTimes: state.blockedTimes,
  };
}
