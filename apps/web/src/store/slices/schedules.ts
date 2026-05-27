import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import type { RequirementWithStatus } from "@uoplan/schedule";
import { getEffectiveSchedule, generateRandomSeed } from "@uoplan/schedule";
import {
  getValidSectionCombos,
  getEnrollmentsForCourse,
  enrollmentsOverlap,
  getFirstOverlapWith,
  generateSchedulesWithPinned,
  cacheWithPerCourseVirtualFilter,
  type CourseEnrollment,
  type GenerationConstraints,
} from "@uoplan/schedule";
import { normalizeCourseCode } from "@uoplan/schedule";
import { courseMatchesFilters } from "@uoplan/schedule";
import { isHonoursProject, canTakeCourse, buildPrereqContext } from "@uoplan/schedule";
import { basicElectivesAfterPinnedDelta } from "../../lib/basicCalendarPins";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
  isElectiveRequirementType,
  isWithinElectiveLevelCap,
  isWithinElectiveLevelBuckets,
  virtualScheduleFilterApplies,
} from "../../lib/electiveEligibility";
import {
  appendCourseDedupedByNorm,
  resolveRequirementIdsForScheduleCourse,
  applyOptionSelections,
  collectRequirementIdsWithCandidateCourse,
} from "../../components/requirements/requirementUtils";
import { compareReqPreference, type AutoAssignReqMeta } from "../requirementCompute/autoAssign";
import { isAdvancedPlannerActive, isBasicPlannerActive } from "../../lib/calendarRoute";
import { flushPersistedAppState } from "../../lib/persistAppState";
import { nextSeed, noteLowestVisitedSeed, repairSeedPosition } from "../../lib/seedNavigation";
import type { GeneratedSchedule } from "@uoplan/schedule";

function tryApplyOneSwap(
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
    generationAllowedDays,
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
    allowedDays: generationAllowedDays,
    minProfessorRating: generationMinProfessorRating ?? undefined,
    professorRatings: professorRatings ?? undefined,
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
  const virtualOnly = isBasicPlannerActive()
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

function applySwapsToResult(
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

function scheduleFingerprint(schedule: GeneratedSchedule): string {
  return schedule.enrollments
    .map((e) => e.courseCode)
    .sort()
    .join(",");
}

type ScheduleGenerationResult = {
  currentSchedule: AppStore["currentSchedule"];
  swapPool: string[];
  chosenCourseToRequirementId: Record<string, string>;
  currentPoolMap: Record<string, string>;
  currentColorMap: Record<string, number>;
  generationError: AppStore["generationError"];
};

function applyScheduleGenerationResult(
  set: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[0],
  get: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[1],
  result: ScheduleGenerationResult,
  seed: number,
) {
  const lowestVisitedSeed = noteLowestVisitedSeed(get().lowestVisitedSeed, seed);
  set({
    ...result,
    currentSeed: seed,
    lowestVisitedSeed,
    calendarWeekIndex: null,
    scheduleNoVariety: false,
  });
}

const validEnrollmentsByCourseCode = new Map<string, CourseEnrollment[]>();

export function clearEnrollmentsCache() {
  validEnrollmentsByCourseCode.clear();
}

async function withScheduleGenerating(
  set: Parameters<StateCreator<AppStore, [], [], SchedulesSlice>>[0],
  run: () => Promise<void>,
) {
  set({ scheduleGenerating: true });
  try {
    await run();
  } finally {
    set({ scheduleGenerating: false });
    flushPersistedAppState();
  }
}

interface SchedulesSlice {
  generateSchedules: AppStore["generateSchedules"];
  generateBasicSchedules: AppStore["generateBasicSchedules"];
  clearSchedule: AppStore["clearSchedule"];
  resetBasicCalendarSettings: AppStore["resetBasicCalendarSettings"];
  markBasicSettingsChanged: AppStore["markBasicSettingsChanged"];
  goToPreviousSeed: AppStore["goToPreviousSeed"];
  goToNextSeed: AppStore["goToNextSeed"];
  randomizeSeed: AppStore["randomizeSeed"];
  swapCourseInSchedule: AppStore["swapCourseInSchedule"];
  undoLastSwap: AppStore["undoLastSwap"];
  getSwapCandidates: AppStore["getSwapCandidates"];
  lockCourseForAllSchedulesFromSwap: AppStore["lockCourseForAllSchedulesFromSwap"];
  unlockCourseForAllSchedulesFromSwap: AppStore["unlockCourseForAllSchedulesFromSwap"];
  blacklistCourseFromSwap: AppStore["blacklistCourseFromSwap"];
  unblacklistCourseFromSwap: AppStore["unblacklistCourseFromSwap"];
  importSchedule: AppStore["importSchedule"];
}

export const createSchedulesSlice: StateCreator<AppStore, [], [], SchedulesSlice> = (set, get) => ({
  generateSchedules: async () => {
    if (get().scheduleGenerating) return;
    await withScheduleGenerating(set, async () => {
      const { generateSchedulesAction } = await import("../../lib/generateSchedulesAction");
      const state = get();
      const swapsToApply = state.currentSwaps;
      const repairedSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
      const isFirstGen = repairedSeed === 0;
      const effectiveState = isFirstGen
        ? { ...state, currentSeed: state.firstSeed }
        : { ...state, currentSeed: repairedSeed };
      const result = await generateSchedulesAction(effectiveState);
      if (result) {
        const resultWithSwaps = applySwapsToResult(result, swapsToApply, get());
        applyScheduleGenerationResult(
          set,
          get,
          resultWithSwaps,
          isFirstGen ? state.firstSeed : repairedSeed,
        );
      }
    });
  },

  generateBasicSchedules: async () => {
    if (get().scheduleGenerating) return;
    await withScheduleGenerating(set, async () => {
      const { generateSchedulesAction } = await import("../../lib/generateSchedulesAction");
      const state = get();
      const swapsToApply = state.currentSwaps;
      const repairedSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
      const isFirstGen = repairedSeed === 0;
      const effectiveState = isFirstGen
        ? { ...state, currentSeed: state.firstSeed }
        : { ...state, currentSeed: repairedSeed };
      const result = await generateSchedulesAction(effectiveState);
      if (result) {
        const resultWithSwaps = applySwapsToResult(result, swapsToApply, get());
        applyScheduleGenerationResult(
          set,
          get,
          resultWithSwaps,
          isFirstGen ? state.firstSeed : repairedSeed,
        );
      }
    });
  },

  clearSchedule: () =>
    set((state) => {
      const alreadyCleared = state.currentSchedule === null && state.generationError === null;
      if (alreadyCleared) return state;
      return {
        currentSchedule: null,
        currentPoolMap: {},
        currentColorMap: {},
        currentSwaps: [],
        swapsPerSeed: {},
        generationError: null,
      };
    }),

  resetBasicCalendarSettings: () =>
    set({
      basicPinnedCourses: [],
      basicElectivesCount: 0,
      basicExcludedCategories: [],
      completedCourses: [],
      frenchImmersionStream: false,
      levelBuckets: [...DEFAULT_BASIC_LEVEL_BUCKETS],
      languageBuckets: [...DEFAULT_BASIC_LANGUAGE_BUCKETS],
      electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
      includeClosedComponents: false,
      virtualSectionsOnly: false,
      currentSchedule: null,
      currentPoolMap: {},
      currentColorMap: {},
      currentSwaps: [],
      swapsPerSeed: {},
      swapPool: [],
      chosenCourseToRequirementId: {},
      generationError: null,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
      scheduleNoVariety: false,
    }),

  markBasicSettingsChanged: () =>
    set({
      generationError: null,
      scheduleNoVariety: false,
    }),

  goToPreviousSeed: async () => {
    const state = get();
    const floor = state.lowestVisitedSeed ?? state.firstSeed;
    if (state.scheduleGenerating || state.currentSeed <= floor) return;
    const prevFingerprint = state.currentSchedule
      ? scheduleFingerprint(state.currentSchedule)
      : null;
    await withScheduleGenerating(set, async () => {
      const newSeed = state.currentSeed - 1;
      const updatedSwapsPerSeed = {
        ...state.swapsPerSeed,
        [state.currentSeed]: state.currentSwaps,
      };
      const newSwaps = updatedSwapsPerSeed[newSeed] ?? [];
      set({
        currentSeed: newSeed,
        currentSwaps: newSwaps,
        swapsPerSeed: updatedSwapsPerSeed,
        calendarWeekIndex: null,
      });
      const { generateSchedulesAction } = await import("../../lib/generateSchedulesAction");
      const result = await generateSchedulesAction({ ...get(), currentSeed: newSeed });
      if (result) {
        const resultWithSwaps = applySwapsToResult(result, newSwaps, get());
        const noVariety =
          prevFingerprint !== null &&
          resultWithSwaps.currentSchedule !== null &&
          scheduleFingerprint(resultWithSwaps.currentSchedule) === prevFingerprint;
        set({ ...resultWithSwaps, currentSeed: newSeed, scheduleNoVariety: noVariety });
      }
    });
  },

  goToNextSeed: async () => {
    const state = get();
    if (state.scheduleGenerating) return;
    const prevFingerprint = state.currentSchedule
      ? scheduleFingerprint(state.currentSchedule)
      : null;
    await withScheduleGenerating(set, async () => {
      const { generateSchedulesAction } = await import("../../lib/generateSchedulesAction");
      const baseSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
      const updatedSwapsPerSeed = {
        ...state.swapsPerSeed,
        [state.currentSeed]: state.currentSwaps,
      };

      let trySeed = nextSeed(state.firstSeed, baseSeed);
      let finalResult: ScheduleGenerationResult | null = null;

      for (let i = 0; i < 30; i++) {
        const swapsForSeed = updatedSwapsPerSeed[trySeed] ?? [];
        const result = await generateSchedulesAction({ ...state, currentSeed: trySeed });
        if (!result) break;
        const withSwaps = applySwapsToResult(result, swapsForSeed, get());
        finalResult = withSwaps;
        if (
          prevFingerprint === null ||
          withSwaps.currentSchedule === null ||
          scheduleFingerprint(withSwaps.currentSchedule) !== prevFingerprint
        ) {
          break;
        }
        trySeed = nextSeed(state.firstSeed, trySeed);
      }

      if (finalResult) {
        const newSwaps = updatedSwapsPerSeed[trySeed] ?? [];
        set({ currentSwaps: newSwaps, swapsPerSeed: updatedSwapsPerSeed, calendarWeekIndex: null });
        applyScheduleGenerationResult(set, get, finalResult, trySeed);
        if (
          prevFingerprint !== null &&
          finalResult.currentSchedule !== null &&
          scheduleFingerprint(finalResult.currentSchedule) === prevFingerprint
        ) {
          set({ scheduleNoVariety: true });
        }
      }
    });
  },

  randomizeSeed: async () => {
    if (get().scheduleGenerating) return;
    const prevFingerprint = get().currentSchedule
      ? scheduleFingerprint(get().currentSchedule!)
      : null;
    await withScheduleGenerating(set, async () => {
      const newFirstSeed = generateRandomSeed();
      set({
        firstSeed: newFirstSeed,
        currentSeed: newFirstSeed,
        lowestVisitedSeed: newFirstSeed,
        currentSwaps: [],
        swapsPerSeed: {},
      });
      const { generateSchedulesAction } = await import("../../lib/generateSchedulesAction");
      const result = await generateSchedulesAction({
        ...get(),
        firstSeed: newFirstSeed,
        currentSeed: newFirstSeed,
      });
      if (result) {
        applyScheduleGenerationResult(set, get, result, newFirstSeed);
        if (
          prevFingerprint !== null &&
          result.currentSchedule !== null &&
          scheduleFingerprint(result.currentSchedule) === prevFingerprint
        ) {
          set({ scheduleNoVariety: true });
        }
      }
    });
  },

  swapCourseInSchedule: async (enrollmentIndex, newCourseCode) => {
    const {
      basicPinnedCourses,
      currentSchedule,
      cache,
      chosenCourseToRequirementId,
      currentPoolMap,
      currentColorMap,
      generationMinStartMinutes,
      generationMaxEndMinutes,
      generationAllowedDays,
      generationMinProfessorRating,
      professorRatings,
      includeClosedComponents,
      virtualSectionsOnly,
      remainingRequirements,
      constrainedPerRequirement,
      selectedPerRequirement,
    } = get();
    if (!cache || !currentSchedule) return;

    const schedule = currentSchedule;
    const oldEnrollment = schedule.enrollments[enrollmentIndex];
    if (!oldEnrollment) return;

    const explicitExemptNormalized = new Set<string>();
    for (const codes of Object.values(constrainedPerRequirement)) {
      for (const code of codes) {
        explicitExemptNormalized.add(normalizeCourseCode(code));
      }
    }
    for (const codes of Object.values(selectedPerRequirement)) {
      for (const code of codes) {
        explicitExemptNormalized.add(normalizeCourseCode(code));
      }
    }

    let virtualOnlyForNewCourse: boolean;
    if (isBasicPlannerActive()) {
      virtualOnlyForNewCourse = virtualSectionsOnly;
    } else {
      const oldCode = oldEnrollment.courseCode;
      const reqId = currentPoolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
      const reqType = remainingRequirements.find((r) => r.requirementId === reqId)?.type;
      virtualOnlyForNewCourse = virtualScheduleFilterApplies(
        virtualSectionsOnly,
        reqType,
        newCourseCode,
        explicitExemptNormalized,
      );
    }

    const newSchedule = getEffectiveSchedule(
      cache,
      newCourseCode,
      includeClosedComponents,
      virtualOnlyForNewCourse,
    );
    if (!newSchedule) return;

    const constraints: GenerationConstraints = {
      minStartMinutes: generationMinStartMinutes,
      maxEndMinutes: generationMaxEndMinutes,
      allowedDays: generationAllowedDays,
      minProfessorRating: generationMinProfessorRating ?? undefined,
      professorRatings: professorRatings ?? undefined,
    };

    if (isBasicPlannerActive()) {
      const allCodes = schedule.enrollments.map((e) => e.courseCode);
      allCodes[enrollmentIndex] = newCourseCode;

      const pinnedNormalized = new Set(basicPinnedCourses.map(normalizeCourseCode));
      const effectiveCache = cacheWithPerCourseVirtualFilter(
        cache,
        includeClosedComponents,
        (code) => virtualSectionsOnly && !pinnedNormalized.has(normalizeCourseCode(code)),
      );

      const batch = generateSchedulesWithPinned(
        allCodes,
        [],
        allCodes.length,
        effectiveCache,
        constraints,
      );

      const validSchedules = batch.filter((s) => s.enrollments.length >= allCodes.length);
      if (validSchedules.length > 0) {
        const oldColorIdx = currentColorMap[oldEnrollment.courseCode];
        const { [oldEnrollment.courseCode]: _, ...mapWithoutOld } = currentColorMap;
        const nextColorMap =
          oldColorIdx !== undefined
            ? { ...mapWithoutOld, [newCourseCode]: oldColorIdx }
            : mapWithoutOld;

        const newCurrentSwaps = [
          ...get().currentSwaps,
          { enrollmentIndex, courseCode: newCourseCode },
        ];
        set({
          currentSchedule: validSchedules[0],
          currentColorMap: nextColorMap,
          currentSwaps: newCurrentSwaps,
          swapsPerSeed: { ...get().swapsPerSeed, [get().currentSeed]: newCurrentSwaps },
        });
      }
      return;
    }

    const combos = getValidSectionCombos(newSchedule, constraints);
    const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);

    for (const combo of combos) {
      const candidate = getEnrollmentsForCourse(newSchedule, combo);
      const conflicts = others.some((e) => enrollmentsOverlap(e, candidate));
      if (!conflicts) {
        const newEnrollments = [...schedule.enrollments];
        newEnrollments[enrollmentIndex] = candidate;
        const oldCode = oldEnrollment.courseCode;
        const poolId = currentPoolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
        const nextPoolMap =
          poolId != null ? { ...currentPoolMap, [newCourseCode]: poolId } : currentPoolMap;

        const oldColorIdx = currentColorMap[oldCode];
        const { [oldCode]: _, ...mapWithoutOld } = currentColorMap;
        const nextColorMap =
          oldColorIdx !== undefined
            ? { ...mapWithoutOld, [newCourseCode]: oldColorIdx }
            : mapWithoutOld;

        const newCurrentSwaps = [
          ...get().currentSwaps,
          { enrollmentIndex, courseCode: newCourseCode },
        ];
        set({
          currentSchedule: { enrollments: newEnrollments },
          currentPoolMap: nextPoolMap,
          currentColorMap: nextColorMap,
          currentSwaps: newCurrentSwaps,
          swapsPerSeed: { ...get().swapsPerSeed, [get().currentSeed]: newCurrentSwaps },
        });
        return;
      }
    }
  },

  undoLastSwap: () => {
    const { currentSwaps, currentSeed, swapsPerSeed } = get();
    if (currentSwaps.length === 0) return;
    const newSwaps = currentSwaps.slice(0, -1);
    set({
      currentSwaps: newSwaps,
      swapsPerSeed: { ...swapsPerSeed, [currentSeed]: newSwaps },
    });
    void get().generateSchedules();
  },

  getSwapCandidates: (enrollmentIndex) => {
    const {
      basicPinnedCourses,
      basicExcludedCategories,
      studentPrograms,
      cache,
      currentSchedule,
      remainingRequirements,
      chosenCourseToRequirementId,
      currentPoolMap,
      completedCourses,
      prereqEligibleCourses,
      levelBuckets,
      languageBuckets,
      electiveLevelBuckets,
      generationMinStartMinutes,
      generationMaxEndMinutes,
      generationAllowedDays,
      generationMinProfessorRating,
      professorRatings,
      includeClosedComponents,
      virtualSectionsOnly,
      filteredPrereqEligibleCourses,
      constrainedPerRequirement,
      selectedPerRequirement,
      generationLimitFirstYearCredits,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
    } = get();
    if (!cache || !currentSchedule) {
      return { candidates: [], poolCourses: [], rejectedWithConflict: [] };
    }

    const schedule = currentSchedule;
    const enrollment = schedule.enrollments[enrollmentIndex];
    if (!enrollment) {
      return { candidates: [], poolCourses: [], rejectedWithConflict: [] };
    }

    const oldCode = enrollment.courseCode;

    if (isBasicPlannerActive()) {
      if (basicPinnedCourses.includes(oldCode)) {
        return { candidates: [], poolCourses: [], rejectedWithConflict: [] };
      }

      const optionalPool: string[] = [];
      const excludedPrefixes = basicExcludedCategories.map((c) => c.toLowerCase());
      const prereqCtx = buildPrereqContext(completedCourses, cache, studentPrograms);
      const basicFilters = { levels: levelBuckets, languageBuckets };

      for (const course of cache.getAllCourses()) {
        const code = course.code;
        if (code === oldCode) continue;
        if (!courseMatchesFilters(code, basicFilters)) continue;
        if (!isWithinElectiveLevelBuckets(code, electiveLevelBuckets)) continue;

        const prefixMatch = code.match(/^([A-Z]{3,4})/i);
        const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
        if (excludedPrefixes.includes(prefix)) continue;

        if (completedCourses.length > 0) {
          if (course.prerequisites) {
            if (!canTakeCourse(code, cache, prereqCtx)) continue;
          } else if (course.prereqText) {
            continue;
          }
        } else {
          if (course.prerequisites || course.prereqText) continue;
        }

        if (basicPinnedCourses.includes(code)) continue;
        const alreadyInSchedule = schedule.enrollments.some((e) => e.courseCode === code);
        if (alreadyInSchedule) continue;

        const sched = getEffectiveSchedule(
          cache,
          code,
          includeClosedComponents,
          virtualSectionsOnly,
        );
        if (!sched) continue;

        const swapConstraints: GenerationConstraints = {
          minStartMinutes: generationMinStartMinutes,
          maxEndMinutes: generationMaxEndMinutes,
          allowedDays: generationAllowedDays,
          minProfessorRating: generationMinProfessorRating ?? undefined,
          professorRatings: professorRatings ?? undefined,
        };
        if (getValidSectionCombos(sched, swapConstraints).length === 0) continue;

        optionalPool.push(code);
      }

      return {
        candidates: optionalPool,
        poolCourses: optionalPool,
        requirementTitle: "Elective",
        rejectedWithConflict: [],
      };
    }

    const poolId = currentPoolMap[oldCode] ?? chosenCourseToRequirementId[oldCode];
    const candidateSet = new Set<string>();
    let poolRequirementType: string | undefined;
    let requirementTitle: string | undefined;

    function findReqNodeById(
      nodes: RequirementWithStatus[],
      id: string,
    ): RequirementWithStatus | null {
      for (const node of nodes) {
        if (node.requirementId === id) return node;
        if (node.options?.length) {
          const found = findReqNodeById(node.options, id);
          if (found) return found;
        }
      }
      return null;
    }

    if (poolId) {
      // Check remaining requirements first; if already satisfied (complete), fall back to the full tree
      const req = remainingRequirements.find((r) => r.requirementId === poolId);
      if (req?.candidateCourses?.length) {
        poolRequirementType = req.type;
        requirementTitle = req.title;
        for (const c of req.candidateCourses) candidateSet.add(c);
      } else {
        const node = findReqNodeById(requirementTreeWithStatus, poolId);
        if (node?.candidateCourses?.length) {
          poolRequirementType = node.type;
          requirementTitle = node.title;
          for (const c of node.candidateCourses) candidateSet.add(c);
        }
      }
    }
    if (candidateSet.size === 0) {
      const oldCodeNorm = normalizeCourseCode(oldCode);
      // Search remaining requirements
      for (const req of remainingRequirements) {
        if (!req.candidateCourses?.length) continue;
        const hasOld = req.candidateCourses.some((c) => normalizeCourseCode(c) === oldCodeNorm);
        if (hasOld) {
          for (const c of req.candidateCourses) candidateSet.add(c);
        }
      }
      // Also search the full tree (includes completed requirements)
      if (candidateSet.size === 0) {
        const flattened = applyOptionSelections(
          requirementTreeWithStatus,
          selectedOptionsPerRequirement,
        );
        const reqIds = collectRequirementIdsWithCandidateCourse(flattened, oldCodeNorm);
        for (const reqId of reqIds) {
          const node = findReqNodeById(flattened, reqId);
          if (node?.candidateCourses?.length) {
            if (!poolRequirementType) poolRequirementType = node.type;
            if (!requirementTitle) requirementTitle = node.title;
            for (const c of node.candidateCourses) candidateSet.add(c);
          }
        }
      }
    }
    if (candidateSet.size === 0) {
      for (const c of filteredPrereqEligibleCourses) candidateSet.add(c);
    }

    const explicitExemptNormalized = new Set<string>();
    for (const codes of Object.values(constrainedPerRequirement)) {
      for (const code of codes) explicitExemptNormalized.add(normalizeCourseCode(code));
    }
    for (const codes of Object.values(selectedPerRequirement)) {
      for (const code of codes) explicitExemptNormalized.add(normalizeCourseCode(code));
    }

    const others = schedule.enrollments.filter(
      (e, i) => i !== enrollmentIndex && e.courseCode !== oldCode,
    );
    const alreadyInSchedule = new Set(schedule.enrollments.map((e) => e.courseCode));

    const isFirstYear = (code: string) => {
      const m = code.match(/\d{4}/);
      return m ? Number(m[0]) < 2000 : false;
    };
    const completedFirstYearCredits = generationLimitFirstYearCredits
      ? completedCourses.reduce((sum, code) => {
          if (!isFirstYear(code)) return sum;
          return sum + (cache.getCourse(code)?.credits ?? 3);
        }, 0)
      : 0;
    const othersFirstYearCredits = generationLimitFirstYearCredits
      ? others.reduce((sum, e) => {
          if (!isFirstYear(e.courseCode)) return sum;
          return sum + (cache.getCourse(e.courseCode)?.credits ?? 3);
        }, 0)
      : 0;
    const remainingFirstYearBudget = generationLimitFirstYearCredits
      ? 48 - completedFirstYearCredits - othersFirstYearCredits
      : Infinity;

    const prereqEligibleSet = new Set(prereqEligibleCourses);
    const swapConstraints: GenerationConstraints = {
      minStartMinutes: generationMinStartMinutes,
      maxEndMinutes: generationMaxEndMinutes,
      allowedDays: generationAllowedDays,
      minProfessorRating: generationMinProfessorRating ?? undefined,
      professorRatings: professorRatings ?? undefined,
    };

    function getValidEnrollmentsFor(code: string): CourseEnrollment[] {
      const virtualOnly = virtualScheduleFilterApplies(
        virtualSectionsOnly,
        poolRequirementType,
        code,
        explicitExemptNormalized,
      );
      const cacheKey = `${code}:${includeClosedComponents}:${virtualOnly}`;
      const cached = validEnrollmentsByCourseCode.get(cacheKey);
      if (cached) return cached;
      const sched = getEffectiveSchedule(cache!, code, includeClosedComponents, virtualOnly);
      if (!sched) {
        validEnrollmentsByCourseCode.set(cacheKey, []);
        return [];
      }
      const combos = getValidSectionCombos(sched, swapConstraints);
      const enrollments = combos.map((combo) => getEnrollmentsForCourse(sched, combo));
      validEnrollmentsByCourseCode.set(cacheKey, enrollments);
      return enrollments;
    }

    const filters = { levels: levelBuckets, languageBuckets };

    const candidates: string[] = [];
    const rejectedWithConflict: Array<{ code: string; conflictsWith: string }> = [];
    for (const code of candidateSet) {
      if (!prereqEligibleSet.has(code)) continue;
      if (code === oldCode) continue;
      if (completedCourses.includes(code)) continue;
      if (alreadyInSchedule.has(code)) continue;
      if (isHonoursProject(code, cache)) continue;
      if (!courseMatchesFilters(code, filters)) continue;
      if (isFirstYear(code) && (cache.getCourse(code)?.credits ?? 3) > remainingFirstYearBudget)
        continue;

      const isElectiveType = isElectiveRequirementType(poolRequirementType);
      const isGenericElective =
        poolRequirementType === "free_elective" ||
        poolRequirementType === "non_discipline_elective" ||
        poolRequirementType === "faculty_elective" ||
        poolRequirementType === "elective";
      if (isElectiveType && !isWithinElectiveLevelCap(code)) continue;
      if (isGenericElective && electiveLevelBuckets.length > 0) {
        const match = code.match(/\d{4}/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!Number.isNaN(num)) {
            const bucket = Math.floor(num / 1000) * 1000;
            if (!electiveLevelBuckets.includes(bucket)) {
              continue;
            }
          }
        }
      }
      const possibleEnrollments = getValidEnrollmentsFor(code);
      if (possibleEnrollments.length === 0) continue;

      let added = false;
      for (const candidate of possibleEnrollments) {
        const conflicts = others.some((e) => enrollmentsOverlap(e, candidate));
        if (!conflicts) {
          candidates.push(code);
          added = true;
          break;
        }
      }
      if (!added && others.length > 0 && possibleEnrollments.length > 0) {
        const conflict = getFirstOverlapWith(possibleEnrollments[0], others);
        if (conflict) {
          rejectedWithConflict.push({
            code,
            conflictsWith: conflict.courseCode,
          });
        }
      }
    }
    const poolCourses = [...candidateSet];
    return { candidates, poolCourses, requirementTitle, rejectedWithConflict };
  },

  lockCourseForAllSchedulesFromSwap: (enrollmentIndex) => {
    const {
      currentSchedule,
      cache,
      basicPinnedCourses,
      basicElectivesCount,
      currentPoolMap,
      chosenCourseToRequirementId,
      remainingRequirements,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
    } = get();
    if (!currentSchedule) return;
    const enrollment = currentSchedule.enrollments[enrollmentIndex];
    if (!enrollment) return;
    const code = enrollment.courseCode;
    const norm = normalizeCourseCode(code);
    const canonical = cache?.getCourse(norm)?.code ?? code;

    if (isBasicPlannerActive()) {
      if (basicPinnedCourses.some((c) => normalizeCourseCode(c) === norm)) {
        return;
      }
      set({
        basicPinnedCourses: [...basicPinnedCourses, canonical],
        basicElectivesCount: basicElectivesAfterPinnedDelta(basicElectivesCount, 1),
        generationError: null,
      });
      return;
    }

    if (!isAdvancedPlannerActive()) return;

    const requirementIds = resolveRequirementIdsForScheduleCourse({
      courseCode: code,
      courseNorm: norm,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
      currentPoolMap,
      chosenCourseToRequirementId,
      remainingRequirements,
    });

    if (requirementIds.length === 0) return;

    const reqMap = new Map(remainingRequirements.map((r) => [r.requirementId, r]));

    let targetId: string;
    if (requirementIds.length === 1) {
      targetId = requirementIds[0];
    } else {
      const metas = requirementIds.flatMap((id) => {
        const req = reqMap.get(id);
        if (!req) return [];
        return [
          {
            reqId: id,
            type: req.type,
            candidatesNorm: new Set(req.candidateCourses.map(normalizeCourseCode)),
            creditsNeeded: req.creditsNeeded ?? 0,
          } satisfies AutoAssignReqMeta,
        ];
      });
      metas.sort(compareReqPreference);
      targetId = metas[0]?.reqId ?? requirementIds[0];
    }

    set((s) => {
      const constrained = s.constrainedPerRequirement[targetId] ?? [];
      const assigned = s.selectedPerRequirement[targetId] ?? [];
      if (
        constrained.some((c) => normalizeCourseCode(c) === norm) ||
        assigned.some((c) => normalizeCourseCode(c) === norm)
      ) {
        return {};
      }
      const merged = appendCourseDedupedByNorm(constrained, canonical, norm);
      if (merged === constrained) return {};
      return {
        constrainedPerRequirement: { ...s.constrainedPerRequirement, [targetId]: merged },
      };
    });
  },

  unlockCourseForAllSchedulesFromSwap: (enrollmentIndex) => {
    const { currentSchedule, basicPinnedCourses, basicElectivesCount, constrainedPerRequirement } =
      get();
    if (!currentSchedule) return;
    const enrollment = currentSchedule.enrollments[enrollmentIndex];
    if (!enrollment) return;
    const norm = normalizeCourseCode(enrollment.courseCode);

    if (isBasicPlannerActive()) {
      const next = basicPinnedCourses.filter((c) => normalizeCourseCode(c) !== norm);
      if (next.length === basicPinnedCourses.length) return;
      set({
        basicPinnedCourses: next,
        basicElectivesCount: basicElectivesAfterPinnedDelta(
          basicElectivesCount,
          next.length - basicPinnedCourses.length,
        ),
        generationError: null,
      });
      return;
    }

    if (!isAdvancedPlannerActive()) return;

    const next: Record<string, string[]> = {};
    let changed = false;
    for (const [rid, codes] of Object.entries(constrainedPerRequirement)) {
      const filtered = codes.filter((c) => normalizeCourseCode(c) !== norm);
      if (filtered.length !== codes.length) changed = true;
      if (filtered.length > 0) next[rid] = filtered;
    }
    if (!changed) return;
    set({ constrainedPerRequirement: next });
  },

  blacklistCourseFromSwap: (enrollmentIndex) => {
    const { currentSchedule, cache, blacklistedCourses } = get();
    if (!currentSchedule) return;
    const enrollment = currentSchedule.enrollments[enrollmentIndex];
    if (!enrollment) return;
    const code = enrollment.courseCode;
    const norm = normalizeCourseCode(code);
    if (blacklistedCourses.some((c) => normalizeCourseCode(c) === norm)) return;
    const canonical = cache?.getCourse(norm)?.code ?? code;
    set({
      blacklistedCourses: [...blacklistedCourses, canonical],
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    });
  },

  unblacklistCourseFromSwap: (enrollmentIndex) => {
    const { currentSchedule, blacklistedCourses } = get();
    if (!currentSchedule) return;
    const enrollment = currentSchedule.enrollments[enrollmentIndex];
    if (!enrollment) return;
    const norm = normalizeCourseCode(enrollment.courseCode);
    const next = blacklistedCourses.filter((c) => normalizeCourseCode(c) !== norm);
    if (next.length === blacklistedCourses.length) return;
    set({
      blacklistedCourses: next,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
    });
  },

  importSchedule: (schedule) => {
    const colorMap: Record<string, number> = {};
    schedule.enrollments.forEach((e, i) => {
      colorMap[e.courseCode] = i % 8;
    });
    set({
      currentSchedule: schedule,
      currentSwaps: [],
      swapsPerSeed: {},
      currentColorMap: colorMap,
      generationError: null,
    });
    flushPersistedAppState();
  },
});
