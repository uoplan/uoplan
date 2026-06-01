import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { getEffectiveSchedule, generateRandomSeed } from "@uoplan/core";
import {
  getValidSectionCombos,
  getEnrollmentsForCourse,
  enrollmentsOverlap,
  timetableFixedCourseSet,
  cacheWithPerCourseVirtualFilter,
  type CourseEnrollment,
  type GenerationConstraints,
} from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { basicElectivesAfterPinnedDelta } from "../../lib/basicCalendarPins";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
  virtualScheduleFilterApplies,
} from "../../lib/electiveEligibility";
import {
  appendCourseDedupedByNorm,
  resolveRequirementIdsForScheduleCourse,
} from "../../lib/requirements/requirementUtils";
import { compareReqPreference, type AutoAssignReqMeta } from "../requirementCompute/autoAssign";
import { flushPersistedAppState } from "../../lib/persistAppState";
import { nextSeed, repairSeedPosition } from "../../lib/seedNavigation";
import { runScheduleGeneration } from "../../workers/scheduleWorkerClient";
import type { GenerateSchedulesMode } from "../../lib/generateSchedulesAction";
import { applySwapsToResult } from "./schedules/swapHelpers";
import {
  applyScheduleGenerationResult,
  scheduleFingerprint,
  withScheduleGenerating,
} from "./schedules/generationState";
import { getSwapCandidates } from "./schedules/swapCandidates";
export type { SchedulesSlice } from "./schedules/types";
import type { ScheduleGenerationResult, SchedulesSlice } from "./schedules/types";

export const createSchedulesSlice: StateCreator<AppStore, [], [], SchedulesSlice> = (set, get) => {
  // Per-store memo of valid section enrollments, invalidated via clearEnrollmentsCache.
  const validEnrollmentsByCourseCode = new Map<string, CourseEnrollment[]>();

  return {
    clearEnrollmentsCache: () => validEnrollmentsByCourseCode.clear(),

    generateSchedules: async () => {
      if (get().scheduleGenerating) return;
      await withScheduleGenerating(set, async () => {
        const state = get();
        const swapsToApply = state.currentSwaps;
        const repairedSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
        const isFirstGen = repairedSeed === 0;
        const effectiveState = isFirstGen
          ? { ...state, currentSeed: state.firstSeed }
          : { ...state, currentSeed: repairedSeed };
        const result = await runScheduleGeneration(effectiveState, "advanced");
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
        const state = get();
        const swapsToApply = state.currentSwaps;
        const repairedSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
        const isFirstGen = repairedSeed === 0;
        const effectiveState = isFirstGen
          ? { ...state, currentSeed: state.firstSeed }
          : { ...state, currentSeed: repairedSeed };
        const result = await runScheduleGeneration(effectiveState, "basic");
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
        generationOptionsDirty: false,
      }),

    markBasicSettingsChanged: () =>
      set({
        generationError: null,
        scheduleNoVariety: false,
        generationOptionsDirty: true,
      }),

    goToPreviousSeed: async () => {
      const state = get();
      const floor = state.lowestVisitedSeed ?? state.firstSeed;
      if (state.scheduleGenerating || state.currentSeed <= floor) return;
      const prevFingerprint = state.currentSchedule
        ? scheduleFingerprint(state.currentSchedule)
        : null;
      await withScheduleGenerating(set, async () => {
        const updatedSwapsPerSeed = {
          ...state.swapsPerSeed,
          [state.currentSeed]: state.currentSwaps,
        };
        const mode: GenerateSchedulesMode = get().calendarMode === "basic" ? "basic" : "advanced";

        let trySeed = state.currentSeed - 1;
        let finalResult: ScheduleGenerationResult | null = null;
        let finalSeed = trySeed;

        for (let i = 0; i < 30; i++) {
          const swapsForSeed = updatedSwapsPerSeed[trySeed] ?? [];
          const result = await runScheduleGeneration({ ...state, currentSeed: trySeed }, mode);
          if (!result) break;
          const withSwaps = applySwapsToResult(result, swapsForSeed, get());
          finalResult = withSwaps;
          finalSeed = trySeed;
          if (
            prevFingerprint === null ||
            withSwaps.currentSchedule === null ||
            scheduleFingerprint(withSwaps.currentSchedule) !== prevFingerprint
          ) {
            break;
          }
          if (trySeed <= floor) break;
          trySeed -= 1;
        }

        if (finalResult) {
          const newSwaps = updatedSwapsPerSeed[finalSeed] ?? [];
          const noVariety =
            prevFingerprint !== null &&
            finalResult.currentSchedule !== null &&
            scheduleFingerprint(finalResult.currentSchedule) === prevFingerprint;
          set({
            ...finalResult,
            currentSeed: finalSeed,
            currentSwaps: newSwaps,
            swapsPerSeed: updatedSwapsPerSeed,
            calendarWeekIndex: null,
            scheduleNoVariety: noVariety,
            generationOptionsDirty: false,
          });
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
        const baseSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
        const updatedSwapsPerSeed = {
          ...state.swapsPerSeed,
          [state.currentSeed]: state.currentSwaps,
        };
        const mode: GenerateSchedulesMode = get().calendarMode === "basic" ? "basic" : "advanced";

        let trySeed = nextSeed(state.firstSeed, baseSeed);
        let finalResult: ScheduleGenerationResult | null = null;

        for (let i = 0; i < 30; i++) {
          const swapsForSeed = updatedSwapsPerSeed[trySeed] ?? [];
          const result = await runScheduleGeneration({ ...state, currentSeed: trySeed }, mode);
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
          set({
            currentSwaps: newSwaps,
            swapsPerSeed: updatedSwapsPerSeed,
            calendarWeekIndex: null,
          });
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
        const mode: GenerateSchedulesMode = get().calendarMode === "basic" ? "basic" : "advanced";
        const result = await runScheduleGeneration(
          { ...get(), firstSeed: newFirstSeed, currentSeed: newFirstSeed },
          mode,
        );
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
      if (get().calendarMode === "basic") {
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
        minProfessorRating: generationMinProfessorRating ?? undefined,
        professorRatings: professorRatings ?? undefined,
        blockedTimes: get().blockedTimes,
      };

      if (get().calendarMode === "basic") {
        const allCodes = schedule.enrollments.map((e) => e.courseCode);
        allCodes[enrollmentIndex] = newCourseCode;

        const pinnedNormalized = new Set(basicPinnedCourses.map(normalizeCourseCode));
        const effectiveCache = cacheWithPerCourseVirtualFilter(
          cache,
          includeClosedComponents,
          (code) => virtualSectionsOnly && !pinnedNormalized.has(normalizeCourseCode(code)),
        );

        const newSched = timetableFixedCourseSet(allCodes, effectiveCache, constraints, {
          seed: get().currentSeed,
        });

        const validSchedules = newSched ? [newSched] : [];
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

    getSwapCandidates: (enrollmentIndex) =>
      getSwapCandidates(enrollmentIndex, get, validEnrollmentsByCourseCode),

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

      if (get().calendarMode === "basic") {
        if (basicPinnedCourses.some((c) => normalizeCourseCode(c) === norm)) {
          return;
        }
        set({
          basicPinnedCourses: [...basicPinnedCourses, canonical],
          basicElectivesCount: basicElectivesAfterPinnedDelta(basicElectivesCount, 1),
          generationError: null,
          generationOptionsDirty: true,
        });
        return;
      }

      if (get().calendarMode !== "advanced") return;

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
          generationOptionsDirty: true,
        };
      });
    },

    unlockCourseForAllSchedulesFromSwap: (enrollmentIndex) => {
      const {
        currentSchedule,
        basicPinnedCourses,
        basicElectivesCount,
        constrainedPerRequirement,
      } = get();
      if (!currentSchedule) return;
      const enrollment = currentSchedule.enrollments[enrollmentIndex];
      if (!enrollment) return;
      const norm = normalizeCourseCode(enrollment.courseCode);

      if (get().calendarMode === "basic") {
        const next = basicPinnedCourses.filter((c) => normalizeCourseCode(c) !== norm);
        if (next.length === basicPinnedCourses.length) return;
        set({
          basicPinnedCourses: next,
          basicElectivesCount: basicElectivesAfterPinnedDelta(
            basicElectivesCount,
            next.length - basicPinnedCourses.length,
          ),
          generationError: null,
          generationOptionsDirty: true,
        });
        return;
      }

      if (get().calendarMode !== "advanced") return;

      const next: Record<string, string[]> = {};
      let changed = false;
      for (const [rid, codes] of Object.entries(constrainedPerRequirement)) {
        const filtered = codes.filter((c) => normalizeCourseCode(c) !== norm);
        if (filtered.length !== codes.length) changed = true;
        if (filtered.length > 0) next[rid] = filtered;
      }
      if (!changed) return;
      set({ constrainedPerRequirement: next, generationOptionsDirty: true });
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
        generationOptionsDirty: true,
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
        generationOptionsDirty: true,
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
        calendarWeekIndex: null,
      });
      flushPersistedAppState();
    },
  };
};
