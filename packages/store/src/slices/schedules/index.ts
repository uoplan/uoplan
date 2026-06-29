import type { StateCreator } from "zustand";
import type { AppStore } from "../../types";
import type { AutoAssignReqMeta, CourseEnrollment } from "@uoplan/core";
import {
  compareReqPreference,
  generateRandomSeed,
  getEffectiveSchedule,
  normalizeCourseCode,
  transferSwapColor,
} from "@uoplan/core";
import { basicElectivesAfterPinnedDelta } from "../../basicCalendarPins";
import { DEFAULT_ADDITIONAL_ELECTIVES_COUNT } from "../../generationDefaults";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
} from "../../electiveEligibility";
import {
  appendCourseDedupedByNorm,
  resolveRequirementIdsForScheduleCourse,
} from "../../requirements/selectionUtils";
import { nextSeed, repairSeedPosition } from "../../seedNavigation";
import type { AppServices, GenerateSchedulesMode } from "../../services";
import { applySwapsToResult, tryApplyOneSwap } from "./swapHelpers";
import { buildSwapConstraints } from "./swapContext";
import {
  applyScheduleGenerationResult,
  isFailurePreservingPrevious,
  scheduleFingerprint,
  withScheduleGenerating,
} from "./generationState";
import { getSwapCandidates } from "./swapCandidates";
import type { ScheduleGenerationResult, SchedulesSlice } from "./types";

export const createSchedulesSlice =
  (services: AppServices): StateCreator<AppStore, [], [], SchedulesSlice> =>
  (set, get) => {
    // Per-store memo of valid section enrollments, invalidated via clearEnrollmentsCache.
    const validEnrollmentsByCourseCode = new Map<string, CourseEnrollment[]>();
    const flush = () => services.persistence.flushEncodedState?.();

    const generateSchedulesForMode = async (mode: GenerateSchedulesMode) => {
      if (get().scheduleGenerating) return;
      await withScheduleGenerating(
        set,
        async () => {
          const state = get();
          const swapsToApply = state.currentSwaps;
          const repairedSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
          const isFirstGen = repairedSeed === 0;
          const effectiveState = isFirstGen
            ? { ...state, currentSeed: state.firstSeed }
            : { ...state, currentSeed: repairedSeed };
          const result = await services.scheduleRunner.run(effectiveState, mode);
          if (result) {
            const resultWithSwaps = applySwapsToResult(result, swapsToApply, get());
            applyScheduleGenerationResult(
              set,
              get,
              resultWithSwaps,
              isFirstGen ? state.firstSeed : repairedSeed,
            );
          }
        },
        flush,
      );
    };

    const findSeedWithVariety = async (opts: {
      state: AppStore;
      mode: GenerateSchedulesMode;
      updatedSwapsPerSeed: AppStore["swapsPerSeed"];
      prevFingerprint: string | null;
      initialSeed: number;
      nextTrySeed: (seed: number) => number | null;
    }) => {
      let trySeed = opts.initialSeed;
      let finalResult: ScheduleGenerationResult | null = null;
      let finalSeed = trySeed;

      for (let i = 0; i < 30; i++) {
        const swapsForSeed = opts.updatedSwapsPerSeed[trySeed] ?? [];
        const result = await services.scheduleRunner.run(
          { ...opts.state, currentSeed: trySeed },
          opts.mode,
        );
        if (!result) break;
        const withSwaps = applySwapsToResult(result, swapsForSeed, get());
        finalResult = withSwaps;
        finalSeed = trySeed;
        if (
          opts.prevFingerprint === null ||
          withSwaps.currentSchedule === null ||
          scheduleFingerprint(withSwaps.currentSchedule) !== opts.prevFingerprint
        ) {
          break;
        }
        const nextTrySeed = opts.nextTrySeed(trySeed);
        if (nextTrySeed === null) break;
        trySeed = nextTrySeed;
      }

      return { finalResult, finalSeed, lastTriedSeed: trySeed };
    };

    const navigateToSeed = async (opts: {
      state: AppStore;
      prevFingerprint: string | null;
      initialSeed: number;
      nextTrySeed: (seed: number) => number | null;
      // Forward navigation (goToNextSeed) applies the last *tried* seed rather than
      // the last *generated* seed: when no variety is found it advances one beyond
      // the displayed schedule so repeated "next" clicks keep progressing. Backward
      // navigation lands exactly on the seed that produced the result.
      applyLastTriedSeed?: boolean;
    }) => {
      const updatedSwapsPerSeed = {
        ...opts.state.swapsPerSeed,
        [opts.state.currentSeed]: opts.state.currentSwaps,
      };
      const mode: GenerateSchedulesMode = get().calendarMode === "basic" ? "basic" : "advanced";

      const { finalResult, finalSeed, lastTriedSeed } = await findSeedWithVariety({
        state: opts.state,
        mode,
        updatedSwapsPerSeed,
        prevFingerprint: opts.prevFingerprint,
        initialSeed: opts.initialSeed,
        nextTrySeed: opts.nextTrySeed,
      });

      if (!finalResult) return;

      const appliedSeed = opts.applyLastTriedSeed ? lastTriedSeed : finalSeed;
      const preserve = isFailurePreservingPrevious(get(), finalResult);
      if (!preserve) {
        const newSwaps = updatedSwapsPerSeed[appliedSeed] ?? [];
        set({
          currentSwaps: newSwaps,
          swapsPerSeed: updatedSwapsPerSeed,
          calendarWeekIndex: null,
        });
      }
      applyScheduleGenerationResult(set, get, finalResult, appliedSeed);
      if (
        !preserve &&
        opts.prevFingerprint !== null &&
        finalResult.currentSchedule !== null &&
        scheduleFingerprint(finalResult.currentSchedule) === opts.prevFingerprint
      ) {
        set({ scheduleNoVariety: true });
      }
    };

    return {
      clearEnrollmentsCache: () => validEnrollmentsByCourseCode.clear(),

      generateSchedules: () => generateSchedulesForMode("advanced"),

      generateBasicSchedules: () => generateSchedulesForMode("basic"),

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
          basketCourses: [],
          additionalElectivesCount: DEFAULT_ADDITIONAL_ELECTIVES_COUNT,
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
        await withScheduleGenerating(
          set,
          async () => {
            await navigateToSeed({
              state,
              prevFingerprint,
              initialSeed: state.currentSeed - 1,
              nextTrySeed: (seed) => (seed <= floor ? null : seed - 1),
            });
          },
          flush,
        );
      },

      goToNextSeed: async () => {
        const state = get();
        if (state.scheduleGenerating) return;
        const prevFingerprint = state.currentSchedule
          ? scheduleFingerprint(state.currentSchedule)
          : null;
        await withScheduleGenerating(
          set,
          async () => {
            const baseSeed = repairSeedPosition(state.firstSeed, state.currentSeed);
            await navigateToSeed({
              state,
              prevFingerprint,
              initialSeed: nextSeed(state.firstSeed, baseSeed),
              nextTrySeed: (seed) => nextSeed(state.firstSeed, seed),
              applyLastTriedSeed: true,
            });
          },
          flush,
        );
      },

      randomizeSeed: async () => {
        if (get().scheduleGenerating) return;
        const prevFingerprint = get().currentSchedule
          ? scheduleFingerprint(get().currentSchedule!)
          : null;
        await withScheduleGenerating(
          set,
          async () => {
            const newFirstSeed = generateRandomSeed();
            const mode: GenerateSchedulesMode =
              get().calendarMode === "basic" ? "basic" : "advanced";
            const result = await services.scheduleRunner.run(
              { ...get(), firstSeed: newFirstSeed, currentSeed: newFirstSeed },
              mode,
            );
            if (result) {
              const preserve = isFailurePreservingPrevious(get(), result);
              if (!preserve) {
                set({
                  firstSeed: newFirstSeed,
                  currentSeed: newFirstSeed,
                  lowestVisitedSeed: newFirstSeed,
                  currentSwaps: [],
                  swapsPerSeed: {},
                });
              }
              applyScheduleGenerationResult(set, get, result, newFirstSeed);
              if (
                !preserve &&
                prevFingerprint !== null &&
                result.currentSchedule !== null &&
                scheduleFingerprint(result.currentSchedule) === prevFingerprint
              ) {
                set({ scheduleNoVariety: true });
              }
            }
          },
          flush,
        );
      },

      swapCourseInSchedule: async (enrollmentIndex, newCourseCode) => {
        const state = get();
        const {
          basketCourses,
          currentSchedule,
          cache,
          catalogue,
          schedulesData,
          yearCatalogueCourses,
          completedCourses,
          chosenCourseToRequirementId,
          currentPoolMap,
          currentColorMap,
          includeClosedComponents,
          virtualSectionsOnly,
        } = state;
        if (!cache || !currentSchedule) return;

        const schedule = currentSchedule;
        const oldEnrollment = schedule.enrollments[enrollmentIndex];
        if (!oldEnrollment) return;
        const oldCode = oldEnrollment.courseCode;

        const appendSwap = (changes: Partial<AppStore>) => {
          const newCurrentSwaps = [
            ...get().currentSwaps,
            { enrollmentIndex, courseCode: newCourseCode },
          ];
          set({
            ...changes,
            currentSwaps: newCurrentSwaps,
            swapsPerSeed: { ...get().swapsPerSeed, [get().currentSeed]: newCurrentSwaps },
          });
        };

        if (state.calendarMode === "basic") {
          const newSchedule = getEffectiveSchedule(
            cache,
            newCourseCode,
            includeClosedComponents,
            virtualSectionsOnly,
          );
          if (!newSchedule) return;

          const allCodes = schedule.enrollments.map((e) => e.courseCode);
          allCodes[enrollmentIndex] = newCourseCode;

          const newSched =
            catalogue && schedulesData
              ? await services.engine.retimetableFixedSet({
                  catalogue,
                  yearCatalogueCourses,
                  completedCourses,
                  schedulesData,
                  cache,
                  courseCodes: allCodes,
                  constraints: buildSwapConstraints(state),
                  seed: get().currentSeed,
                  includeClosedComponents,
                  virtualSectionsOnly,
                  virtualExemptCourses: basketCourses,
                  optimizationPriorities: get().optimizationPriorities,
                })
              : null;
          if (!newSched) return;

          appendSwap({
            currentSchedule: newSched,
            currentColorMap: transferSwapColor(currentColorMap, oldCode, newCourseCode),
          });
          return;
        }

        const applied = tryApplyOneSwap(
          schedule,
          enrollmentIndex,
          newCourseCode,
          currentPoolMap,
          currentColorMap,
          chosenCourseToRequirementId,
          state,
        );
        if (!applied) return;
        appendSwap({
          currentSchedule: applied.schedule,
          currentPoolMap: applied.poolMap,
          currentColorMap: applied.colorMap,
        });
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
          basketCourses,
          additionalElectivesCount,
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
          if (basketCourses.some((c) => normalizeCourseCode(c) === norm)) {
            return;
          }
          set({
            basketCourses: [...basketCourses, canonical],
            additionalElectivesCount: basicElectivesAfterPinnedDelta(additionalElectivesCount, 1),
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
          basketCourses,
          additionalElectivesCount,
          constrainedPerRequirement,
        } = get();
        if (!currentSchedule) return;
        const enrollment = currentSchedule.enrollments[enrollmentIndex];
        if (!enrollment) return;
        const norm = normalizeCourseCode(enrollment.courseCode);

        if (get().calendarMode === "basic") {
          const next = basketCourses.filter((c) => normalizeCourseCode(c) !== norm);
          if (next.length === basketCourses.length) return;
          set({
            basketCourses: next,
            additionalElectivesCount: basicElectivesAfterPinnedDelta(
              additionalElectivesCount,
              next.length - basketCourses.length,
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
        for (const [i, e] of schedule.enrollments.entries()) {
          colorMap[e.courseCode] = i % 8;
        }
        set({
          currentSchedule: schedule,
          currentSwaps: [],
          swapsPerSeed: {},
          currentColorMap: colorMap,
          generationError: null,
          calendarWeekIndex: null,
        });
        void services.persistence.flushEncodedState?.();
      },
    };
  };
