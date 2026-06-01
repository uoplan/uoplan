import type { AppStore } from "../../types";
import type { GeneratedSchedule, GenerationConstraints } from "@uoplan/core";
import {
  enrollmentsOverlap,
  getEffectiveSchedule,
  getEnrollmentsForCourse,
  getValidSectionCombos,
  normalizeCourseCode,
  virtualScheduleFilterApplies,
} from "@uoplan/core";
import type { ScheduleGenerationResult } from "./types";

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
  const {
    cache,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationMinProfessorRating,
    professorRatings,
    includeClosedComponents,
    virtualSectionsOnly,
    remainingRequirements,
    constrainedPerRequirement,
    selectedPerRequirement,
  } = state;

  if (!cache) return null;

  const oldEnrollment = schedule.enrollments[enrollmentIndex];
  if (!oldEnrollment) return null;

  const oldCode = oldEnrollment.courseCode;

  const constraints: GenerationConstraints = {
    minStartMinutes: generationMinStartMinutes,
    maxEndMinutes: generationMaxEndMinutes,
    minProfessorRating: generationMinProfessorRating ?? undefined,
    professorRatings: professorRatings ?? undefined,
    blockedTimes: state.blockedTimes,
  };

  const explicitExemptNormalized = new Set<string>();
  for (const codes of Object.values(constrainedPerRequirement)) {
    for (const code of codes) explicitExemptNormalized.add(normalizeCourseCode(code));
  }
  for (const codes of Object.values(selectedPerRequirement)) {
    for (const code of codes) explicitExemptNormalized.add(normalizeCourseCode(code));
  }

  const reqId = poolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
  const reqType = remainingRequirements.find((r) => r.requirementId === reqId)?.type;
  const virtualOnly =
    state.calendarMode === "basic"
      ? virtualSectionsOnly
      : virtualScheduleFilterApplies(
          virtualSectionsOnly,
          reqType,
          newCourseCode,
          explicitExemptNormalized,
        );

  const newScheduleData = getEffectiveSchedule(
    cache,
    newCourseCode,
    includeClosedComponents,
    virtualOnly,
  );
  if (!newScheduleData) return null;

  const combos = getValidSectionCombos(newScheduleData, constraints);
  const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);

  for (const combo of combos) {
    const candidate = getEnrollmentsForCourse(newScheduleData, combo);
    if (!others.some((e) => enrollmentsOverlap(e, candidate))) {
      const newEnrollments = [...schedule.enrollments];
      newEnrollments[enrollmentIndex] = candidate;

      const poolId = poolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
      const nextPoolMap = poolId != null ? { ...poolMap, [newCourseCode]: poolId } : poolMap;

      const oldColorIdx = colorMap[oldCode];
      const { [oldCode]: _, ...mapWithoutOld } = colorMap;
      const nextColorMap =
        oldColorIdx !== undefined
          ? { ...mapWithoutOld, [newCourseCode]: oldColorIdx }
          : mapWithoutOld;

      return {
        schedule: { enrollments: newEnrollments },
        poolMap: nextPoolMap,
        colorMap: nextColorMap,
      };
    }
  }

  return null;
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
