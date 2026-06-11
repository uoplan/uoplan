import type { AppStore } from "../../types";
import type { GeneratedSchedule } from "@uoplan/core";
import { firstFittingEnrollment, getEffectiveSchedule, transferSwapColor } from "@uoplan/core";
import type { ScheduleGenerationResult } from "./types";
import {
  buildExplicitExemptSet,
  buildSwapConstraints,
  resolveSwapVirtualOnly,
  transferPoolEntry,
} from "./swapContext";

export function tryApplyOneSwap(
  schedule: GeneratedSchedule,
  enrollmentIndex: number,
  newCourseCode: string,
  poolMap: Record<string, string>,
  colorMap: Record<string, number>,
  chosenCourseToRequirementId: Record<string, string>,
  state: AppStore,
): {
  schedule: GeneratedSchedule;
  poolMap: Record<string, string>;
  colorMap: Record<string, number>;
} | null {
  const { cache, includeClosedComponents, virtualSectionsOnly, remainingRequirements } = state;

  if (!cache) return null;

  const oldEnrollment = schedule.enrollments[enrollmentIndex];
  if (!oldEnrollment) return null;

  const oldCode = oldEnrollment.courseCode;
  const reqId = poolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
  const reqType = remainingRequirements.find((r) => r.requirementId === reqId)?.type;

  const exempt = buildExplicitExemptSet(
    state.constrainedPerRequirement,
    state.selectedPerRequirement,
  );
  const virtualOnly = resolveSwapVirtualOnly(
    state.calendarMode,
    virtualSectionsOnly,
    reqType,
    newCourseCode,
    exempt,
  );

  const newScheduleData = getEffectiveSchedule(
    cache,
    newCourseCode,
    includeClosedComponents,
    virtualOnly,
  );
  if (!newScheduleData) return null;

  const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);
  const candidate = firstFittingEnrollment(newScheduleData, buildSwapConstraints(state), others);
  if (!candidate) return null;

  const newEnrollments = [...schedule.enrollments];
  newEnrollments[enrollmentIndex] = candidate;

  return {
    schedule: { enrollments: newEnrollments },
    poolMap: transferPoolEntry(poolMap, oldCode, newCourseCode, reqId),
    colorMap: transferSwapColor(colorMap, oldCode, newCourseCode),
  };
}

export function applySwapsToResult(
  result: ScheduleGenerationResult,
  swaps: Array<{ enrollmentIndex: number; courseCode: string }>,
  state: AppStore,
): ScheduleGenerationResult {
  if (swaps.length === 0 || !result.currentSchedule) return result;

  let currentSchedule = result.currentSchedule;
  let currentPoolMap = result.currentPoolMap;
  let currentColorMap = result.currentColorMap;

  for (const swap of swaps) {
    const applied = tryApplyOneSwap(
      currentSchedule,
      swap.enrollmentIndex,
      swap.courseCode,
      currentPoolMap,
      currentColorMap,
      result.chosenCourseToRequirementId,
      state,
    );
    if (applied) {
      currentSchedule = applied.schedule;
      currentPoolMap = applied.poolMap;
      currentColorMap = applied.colorMap;
    }
  }

  return { ...result, currentSchedule, currentPoolMap, currentColorMap };
}
