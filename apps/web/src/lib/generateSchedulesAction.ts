import type {
  BlockedTime,
  FilterHintDescriptor,
  GenerationErrorDetails,
  GenerationErrorState,
  GenerationMessageDescriptor,
} from "@uoplan/store/types";
import {
  buildEffectiveRemainingRequirements,
  cacheWithClosedFilter,
  cacheWithPerCourseVirtualFilter,
  diagnoseTimetableFailure,
  gateRemainingByPriority,
  normalizeCourseCode,
  resolveDesiredCourses,
  runAdvancedGeneration,
  runBasicGeneration,
} from "@uoplan/core";
import type {
  AdvancedRequestInput,
  BasicRequestInput,
  DataCache,
  GeneratedSchedule,
  GenerationConstraints,
  MappedGenerationResult,
  RequirementWithStatus,
  ScheduleEngine,
  TimetableFailureDiagnostics,
} from "@uoplan/core";
import { buildColorMap } from "./colorMap";
import { avoidedDaysFromBlocks } from "@uoplan/store/blockedTimes";
import type { GenerateSchedulesInput } from "@uoplan/store/generationInput";
import { SCHEDULE_COURSE_COUNT_MAX } from "@uoplan/store/generationDefaults";

// Re-export helpers used by tests and other modules
export { expandConstrainedPerRequirement, buildPendingGroupPickCounts } from "@uoplan/core";
export { type GenerateSchedulesInput } from "@uoplan/store/generationInput";

/** Pool diagnostics shape carried by a mapped engine response. */
type PoolDiagnostics = NonNullable<MappedGenerationResult["poolDiagnostics"]>;

const DEFAULT_MIN_START_MINUTES = 8 * 60 + 30;
const DEFAULT_MAX_END_MINUTES = 22 * 60;
const DEFAULT_LANGUAGE_BUCKETS = ["en", "other"];

function sumCompletedFirstYearCredits(
  completedCourses: readonly string[],
  cache: DataCache,
): number {
  return completedCourses.reduce((sum, code) => {
    const m = code.match(/\d{4}/);
    if (!m || Number(m[0]) >= 2000) return sum;
    const course = cache.getCourse(code);
    return sum + (course?.credits ?? 3);
  }, 0);
}

function clampAdditionalElectiveCount(count: number, selectedCount: number): number {
  const max = Math.max(0, SCHEDULE_COURSE_COUNT_MAX - selectedCount);
  return Math.max(0, Math.min(max, count));
}

function buildActiveFilterHints(opts: {
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  blockedTimes: readonly BlockedTime[];
  virtualSectionsOnly: boolean;
  includeClosedComponents: boolean;
  languageBuckets: string[];
}): FilterHintDescriptor[] {
  const hints: FilterHintDescriptor[] = [];
  const {
    generationMinStartMinutes,
    generationMaxEndMinutes,
    blockedTimes,
    virtualSectionsOnly,
    includeClosedComponents,
    languageBuckets,
  } = opts;

  if (generationMinStartMinutes > DEFAULT_MIN_START_MINUTES) {
    const h = Math.floor(generationMinStartMinutes / 60);
    const m = generationMinStartMinutes % 60;
    hints.push({ code: "start-after", time: `${h}:${m.toString().padStart(2, "0")}` });
  }

  if (generationMaxEndMinutes < DEFAULT_MAX_END_MINUTES) {
    const h = Math.floor(generationMaxEndMinutes / 60);
    const m = generationMaxEndMinutes % 60;
    hints.push({ code: "end-before", time: `${h}:${m.toString().padStart(2, "0")}` });
  }

  const avoidedDays = avoidedDaysFromBlocks(blockedTimes);
  if (avoidedDays.length > 0) {
    hints.push({ code: "days-excluded", days: avoidedDays });
  }

  if (virtualSectionsOnly) {
    hints.push({ code: "virtual-only" });
  }

  if (!includeClosedComponents) {
    hints.push({ code: "closed-excluded" });
  }

  const isSameAsDefaultLang =
    languageBuckets.length === DEFAULT_LANGUAGE_BUCKETS.length &&
    DEFAULT_LANGUAGE_BUCKETS.every((b) => languageBuckets.includes(b));
  if (!isSameAsDefaultLang) {
    hints.push({ code: "language-filter", langs: languageBuckets });
  }

  return hints;
}

function buildTimetableFailureDiagnostics(
  poolDiagnostics: PoolDiagnostics | null,
  pinned: string[],
  filteredOptionalPool: string[],
  coursesThisSemester: number,
  cache: ReturnType<typeof cacheWithClosedFilter>,
  constraints: GenerationConstraints,
  activeFilterHints?: FilterHintDescriptor[],
): { details: GenerationErrorDetails; timetableFailure: TimetableFailureDiagnostics } {
  const timetableFailure = diagnoseTimetableFailure({
    pinnedCourseCodes: pinned,
    optionalCourseCodes: filteredOptionalPool,
    targetCount: coursesThisSemester,
    cache,
    constraints,
  });
  const details: GenerationErrorDetails = {
    emptyPools: poolDiagnostics?.emptyPools ?? [],
    totalAvailable: poolDiagnostics?.totalAvailable ?? pinned.length + filteredOptionalPool.length,
    totalNeeded: poolDiagnostics?.totalNeeded ?? coursesThisSemester,
    timetableFailure,
    activeFilterHints,
  };
  return { details, timetableFailure };
}

function generationErrorState(
  message: GenerationMessageDescriptor,
  details: GenerationErrorDetails | null = null,
): GenerationErrorState {
  return { message, details };
}

interface GenerateSchedulesResult {
  currentSchedule: GeneratedSchedule | null;
  swapPool: string[];
  chosenCourseToRequirementId: Record<string, string>;
  currentPoolMap: Record<string, string>;
  currentColorMap: Record<string, number>;
  generationError: GenerationErrorState | null;
}

export type { GenerateSchedulesResult };

export async function generateSchedulesAction(
  input: GenerateSchedulesInput,
  cache: DataCache,
  engine: ScheduleEngine,
): Promise<GenerateSchedulesResult | null> {
  if (input.mode === "basic") {
    return await handleBasicGeneration(input, cache, engine);
  }

  const {
    remainingRequirements: rawRemainingRequirements,
    requirementPriorities,
    requirementTreeWithStatus,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    constrainedPerRequirement: rawConstrainedPerRequirement,
    coursesThisSemester,
    additionalElectivesCount,
    completedCourses,
    basketCourses,
    basicExcludedCategories,
    prereqEligibleCourses,
    unassignedCompletedCourses,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    professorRatings,
    currentSeed,
    firstSeed,
    includeClosedComponents,
    virtualSectionsOnly,
    generationLimitFirstYearCredits,
    optimizationPriorities,
    courseSentimentByNorm,
    frenchImmersionStream,
  } = input;

  // Strict priority gate: only offer requirements at the lowest priority tier still outstanding.
  // A no-op when the user has not set any priorities (all default 0).
  const remainingRequirements = gateRemainingByPriority(
    rawRemainingRequirements,
    requirementPriorities,
  );

  const unassigned = [...new Set(unassignedCompletedCourses)].sort();
  if (unassigned.length > 0) {
    const previewLimit = 12;
    const preview = unassigned.slice(0, previewLimit);
    const overflow = unassigned.length > previewLimit ? unassigned.length - previewLimit : 0;
    return {
      currentSchedule: null,
      swapPool: [],
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState({
        kind: "unassigned-completed",
        count: unassigned.length,
        preview,
        overflow,
      }),
    };
  }

  // Detect missing option group selections before running generation
  const missingOptionGroups: string[] = [];
  function walkNodes(
    nodes: RequirementWithStatus[],
    parentRequirementId?: string,
    parentSelectedIndex?: number,
    parentChildIndex?: number,
  ): void {
    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx];
      const parentActive =
        parentRequirementId == null ||
        parentSelectedIndex == null ||
        parentSelectedIndex === parentChildIndex;
      if (!parentActive) continue;

      if (
        (node.type === "or_group" || node.type === "options_group") &&
        node.requirementId &&
        !node.complete
      ) {
        const sel = selectedOptionsPerRequirement[node.requirementId];
        if (sel == null) missingOptionGroups.push(node.title ?? node.type);
      }

      if (node.options && node.options.length > 0) {
        const currentReqId = node.requirementId;
        const currentSelectedIndex =
          currentReqId != null ? selectedOptionsPerRequirement[currentReqId] : undefined;
        for (let childIdx = 0; childIdx < node.options.length; childIdx++) {
          walkNodes(
            [node.options[childIdx]],
            currentReqId ?? parentRequirementId,
            currentReqId != null ? currentSelectedIndex : parentSelectedIndex,
            childIdx,
          );
        }
      }
    }
  }
  walkNodes(requirementTreeWithStatus);

  if (missingOptionGroups.length > 0) {
    return {
      currentSchedule: null,
      swapPool: [],
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState({ kind: "complete-assign" }),
    };
  }

  const completedFirstYearCredits = sumCompletedFirstYearCredits(completedCourses, cache);

  const constraints: GenerationConstraints = {
    minStartMinutes: generationMinStartMinutes,
    maxEndMinutes: generationMaxEndMinutes,
    professorRatings: professorRatings ?? undefined,
    maxFirstYearCredits: generationLimitFirstYearCredits
      ? Math.max(0, 48 - (completedFirstYearCredits ?? 0))
      : undefined,
    blockedTimes: input.blockedTimes,
  };

  // Resolve the unified "courses you want" list against the SAME requirement universe the engine
  // schedules against (base + selected option branches): prereq-eligible courses that match a
  // requirement are unioned into the constrained map (so they count toward that requirement); the
  // rest are force-pinned as their own pool.
  const effectiveRemainingRequirements = buildEffectiveRemainingRequirements(
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
  );
  const desiredResolution = resolveDesiredCourses(
    effectiveRemainingRequirements,
    basketCourses,
    completedCourses,
    rawConstrainedPerRequirement,
    selectedPerRequirement,
    prereqEligibleCourses,
    cache,
  );

  const effectiveConstrainedPerRequirement: Record<string, string[]> = {};
  for (const [reqId, codes] of Object.entries(rawConstrainedPerRequirement)) {
    effectiveConstrainedPerRequirement[reqId] = [...codes];
  }
  for (const [reqId, codes] of Object.entries(desiredResolution.assigned)) {
    const existing = effectiveConstrainedPerRequirement[reqId] ?? [];
    const merged = new Set(existing.map((c) => normalizeCourseCode(c)));
    const out = [...existing];
    for (const code of codes) {
      if (!merged.has(normalizeCourseCode(code))) out.push(code);
    }
    effectiveConstrainedPerRequirement[reqId] = out;
  }

  // The cart (basket) is the highest-priority capped pool: route the WHOLE
  // resolved cart through `forcedCourses` so `coursesThisSemester` (N) caps how
  // many cart courses are scheduled. Courses that also map to a requirement stay
  // in the constrained map purely for attribution (the engine excludes forced
  // courses from the explicit-union pin path, so this never defeats the cap).
  const resolvedCart = [
    ...new Set([
      ...desiredResolution.standalone,
      ...Object.values(desiredResolution.assigned).flat(),
    ]),
  ];

  const advancedInput: AdvancedRequestInput = {
    constraints,
    completedCourses,
    prereqEligibleCourses,
    remainingRequirements,
    requirementTreeWithStatus,
    constrainedPerRequirementRaw: effectiveConstrainedPerRequirement,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    coursesThisSemester,
    additionalElectivesCount,
    forcedCourses: resolvedCart,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    optimizationPriorities,
    courseSentimentByNorm,
    frenchImmersionStream,
    blacklistedCourses: input.blacklistedCourses ?? [],
    basicExcludedCategories,
    currentSeed,
    firstSeed,
  };
  const result = runAdvancedGeneration(engine, advancedInput, cache);

  const {
    schedule: foundSchedule,
    optionalPool: filteredOptionalPool,
    pinned,
    poolDiagnostics,
  } = result;

  const filterHints = buildActiveFilterHints({
    generationMinStartMinutes,
    generationMaxEndMinutes,
    blockedTimes: input.blockedTimes,
    virtualSectionsOnly,
    includeClosedComponents,
    languageBuckets,
  });

  // Total courses the engine aims to schedule: the cart-cap / requirement-fill
  // target (N) plus the additional electives generated on top (M).
  const advancedTargetCount = coursesThisSemester + additionalElectivesCount;
  const optionalSlotsNeeded = advancedTargetCount - pinned.length;
  if (filteredOptionalPool.length < optionalSlotsNeeded) {
    const swapPool = [...new Set([...pinned, ...filteredOptionalPool])];
    return {
      currentSchedule: null,
      swapPool,
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState(
        { kind: "not-enough-courses" },
        {
          emptyPools: poolDiagnostics?.emptyPools ?? [],
          totalAvailable: poolDiagnostics?.totalAvailable ?? swapPool.length,
          totalNeeded: poolDiagnostics?.totalNeeded ?? advancedTargetCount,
          timetableFailure: null as unknown as TimetableFailureDiagnostics,
          activeFilterHints: filterHints,
        },
      ),
    };
  }

  if (!foundSchedule) {
    const diagCache = cacheWithClosedFilter(cache, includeClosedComponents, false);
    const { details, timetableFailure } = buildTimetableFailureDiagnostics(
      poolDiagnostics,
      pinned,
      filteredOptionalPool,
      advancedTargetCount,
      diagCache,
      constraints,
      filterHints,
    );
    const swapPool = [...new Set([...pinned, ...filteredOptionalPool])];
    return {
      currentSchedule: null,
      swapPool,
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState({ kind: "lead", lead: timetableFailure.lead }, details),
    };
  }

  const swapPool = [...new Set([...pinned, ...filteredOptionalPool])];
  return {
    currentSchedule: foundSchedule,
    swapPool,
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: buildColorMap(foundSchedule),
    generationError: null,
  };
}

async function handleBasicGeneration(
  input: GenerateSchedulesInput,
  cache: DataCache,
  engine: ScheduleEngine,
): Promise<GenerateSchedulesResult | null> {
  const {
    basketCourses,
    additionalElectivesCount,
    basicExcludedCategories,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    professorRatings,
    currentSeed,
    firstSeed,
    includeClosedComponents,
    virtualSectionsOnly,
    optimizationPriorities,
    courseSentimentByNorm,
    generationLimitFirstYearCredits,
    completedCourses,
    studentPrograms,
    frenchImmersionStream,
    blacklistedCourses: basicBlacklistedCourses,
  } = input;

  const completedFirstYearCredits = sumCompletedFirstYearCredits(completedCourses, cache);
  const effectiveAdditionalElectivesCount = clampAdditionalElectiveCount(
    additionalElectivesCount,
    basketCourses.length,
  );
  const basicCoursesThisSemester = basketCourses.length;

  const constraints: GenerationConstraints = {
    minStartMinutes: generationMinStartMinutes,
    maxEndMinutes: generationMaxEndMinutes,
    professorRatings: professorRatings ?? undefined,
    maxFirstYearCredits: generationLimitFirstYearCredits
      ? Math.max(0, 48 - completedFirstYearCredits)
      : undefined,
    blockedTimes: input.blockedTimes,
  };

  const basicInput: BasicRequestInput = {
    constraints,
    basketCourses,
    additionalElectivesCount: effectiveAdditionalElectivesCount,
    coursesThisSemester: basicCoursesThisSemester,
    basicExcludedCategories,
    completedCourses,
    studentPrograms,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    optimizationPriorities,
    courseSentimentByNorm,
    frenchImmersionStream,
    blacklistedCourses: basicBlacklistedCourses ?? [],
    currentSeed,
    firstSeed,
  };

  const { schedule, optionalPool } = runBasicGeneration(engine, basicInput, cache);

  const swapPool = [...new Set([...basketCourses, ...optionalPool])];

  if (!schedule) {
    const timetableTarget = basicCoursesThisSemester + effectiveAdditionalElectivesCount;
    const timetableFailure = diagnoseTimetableFailure({
      pinnedCourseCodes: basketCourses,
      optionalCourseCodes: optionalPool,
      targetCount: timetableTarget,
      cache: cacheWithPerCourseVirtualFilter(
        cache,
        includeClosedComponents,
        (code) =>
          virtualSectionsOnly &&
          !new Set(basketCourses.map(normalizeCourseCode)).has(normalizeCourseCode(code)),
      ),
      constraints,
    });

    return {
      currentSchedule: null,
      swapPool,
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: {
        message: { kind: "lead", lead: timetableFailure.lead },
        details: {
          emptyPools: [],
          totalAvailable: basketCourses.length + optionalPool.length,
          totalNeeded: timetableTarget,
          timetableFailure,
        },
      },
    };
  }

  return {
    currentSchedule: schedule,
    swapPool,
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: buildColorMap(schedule),
    generationError: null,
  };
}
