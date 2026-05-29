import type { AppState } from "../store/types";
import type { GenerationErrorDetails, GenerationErrorState } from "../store/types";
import {
  type DataCache,
  type GeneratedSchedule,
  type GenerationConstraints,
  type RequirementWithStatus,
  cacheWithClosedFilter,
  cacheWithPerCourseVirtualFilter,
  normalizeCourseCode,
  diagnoseTimetableFailure,
  type TimetableFailureDiagnostics,
} from "@uoplan/schedule";
import {
  generateBasicSchedule,
  generateAdvancedSchedule,
  type PoolDiagnostics,
} from "@uoplan/calendar";
import { buildColorMap } from "./colorMap";

// Re-export helpers used by tests and other modules
export { expandConstrainedPerRequirement, buildPendingGroupPickCounts } from "@uoplan/calendar";

export type GenerateSchedulesMode = "basic" | "advanced";

/**
 * Subset of {@link AppState} fields the generator reads. Pick<> keeps this in
 * lock-step with AppState so adding a new field to the action automatically
 * propagates a compile error here.
 */
export type GenerateSchedulesInput = Pick<
  AppState,
  | "basicPinnedCourses"
  | "basicElectivesCount"
  | "basicExcludedCategories"
  | "completedCourses"
  | "studentPrograms"
  | "program"
  | "remainingRequirements"
  | "requirementTreeWithStatus"
  | "selectedPerRequirement"
  | "selectedOptionsPerRequirement"
  | "constrainedPerRequirement"
  | "coursesThisSemester"
  | "prereqEligibleCourses"
  | "unassignedCompletedCourses"
  | "levelBuckets"
  | "languageBuckets"
  | "electiveLevelBuckets"
  | "generationMinStartMinutes"
  | "generationMaxEndMinutes"
  | "generationAllowedDays"
  | "generationMinProfessorRating"
  | "professorRatings"
  | "currentSeed"
  | "firstSeed"
  | "includeClosedComponents"
  | "virtualSectionsOnly"
  | "generationLimitFirstYearCredits"
  | "generationCompressedSchedule"
  | "generationPreferEasier"
  | "frenchImmersionStream"
  | "blacklistedCourses"
> & {
  /** Set explicitly by callers instead of read from module-global state. */
  mode: GenerateSchedulesMode;
};

/** Extract the worker-safe input from an AppState snapshot. */
export function pickGenerateSchedulesInput(
  state: AppState,
  mode: GenerateSchedulesMode,
): GenerateSchedulesInput {
  return {
    mode,
    basicPinnedCourses: state.basicPinnedCourses,
    basicElectivesCount: state.basicElectivesCount,
    basicExcludedCategories: state.basicExcludedCategories,
    completedCourses: state.completedCourses,
    studentPrograms: state.studentPrograms,
    program: state.program,
    remainingRequirements: state.remainingRequirements,
    requirementTreeWithStatus: state.requirementTreeWithStatus,
    selectedPerRequirement: state.selectedPerRequirement,
    selectedOptionsPerRequirement: state.selectedOptionsPerRequirement,
    constrainedPerRequirement: state.constrainedPerRequirement,
    coursesThisSemester: state.coursesThisSemester,
    prereqEligibleCourses: state.prereqEligibleCourses,
    unassignedCompletedCourses: state.unassignedCompletedCourses,
    levelBuckets: state.levelBuckets,
    languageBuckets: state.languageBuckets,
    electiveLevelBuckets: state.electiveLevelBuckets,
    generationMinStartMinutes: state.generationMinStartMinutes,
    generationMaxEndMinutes: state.generationMaxEndMinutes,
    generationAllowedDays: state.generationAllowedDays,
    generationMinProfessorRating: state.generationMinProfessorRating,
    professorRatings: state.professorRatings,
    currentSeed: state.currentSeed,
    firstSeed: state.firstSeed,
    includeClosedComponents: state.includeClosedComponents,
    virtualSectionsOnly: state.virtualSectionsOnly,
    generationLimitFirstYearCredits: state.generationLimitFirstYearCredits,
    generationCompressedSchedule: state.generationCompressedSchedule,
    generationPreferEasier: state.generationPreferEasier,
    frenchImmersionStream: state.frenchImmersionStream,
    blacklistedCourses: state.blacklistedCourses,
  };
}

const DEFAULT_MIN_START_MINUTES = 8 * 60 + 30;
const DEFAULT_MAX_END_MINUTES = 22 * 60;
const DEFAULT_ALLOWED_DAYS = ["Mo", "Tu", "We", "Th", "Fr"];
const DEFAULT_LANGUAGE_BUCKETS = ["en", "other"];

const DAY_NAMES: Record<string, string> = {
  Mo: "Mon",
  Tu: "Tue",
  We: "Wed",
  Th: "Thu",
  Fr: "Fri",
  Sa: "Sat",
  Su: "Sun",
};

function buildActiveFilterHints(opts: {
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationAllowedDays: string[];
  generationMinProfessorRating: number | null | undefined;
  virtualSectionsOnly: boolean;
  includeClosedComponents: boolean;
  languageBuckets: string[];
}): string[] {
  const hints: string[] = [];
  const {
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    virtualSectionsOnly,
    includeClosedComponents,
    languageBuckets,
  } = opts;

  if (generationMinStartMinutes > DEFAULT_MIN_START_MINUTES) {
    const h = Math.floor(generationMinStartMinutes / 60);
    const m = generationMinStartMinutes % 60;
    hints.push(`Start time restricted to after ${h}:${m.toString().padStart(2, "0")}`);
  }

  if (generationMaxEndMinutes < DEFAULT_MAX_END_MINUTES) {
    const h = Math.floor(generationMaxEndMinutes / 60);
    const m = generationMaxEndMinutes % 60;
    hints.push(`End time restricted to before ${h}:${m.toString().padStart(2, "0")}`);
  }

  const missingDays = DEFAULT_ALLOWED_DAYS.filter((d) => !generationAllowedDays.includes(d));
  if (missingDays.length > 0) {
    hints.push(`Days excluded: ${missingDays.map((d) => DAY_NAMES[d] ?? d).join(", ")}`);
  }

  if (generationMinProfessorRating != null) {
    hints.push(`Professor rating ≥ ${generationMinProfessorRating}`);
  }

  if (virtualSectionsOnly) {
    hints.push("Virtual sections only");
  }

  if (!includeClosedComponents) {
    hints.push('Closed sections excluded — try enabling "Include closed sections"');
  }

  const isSameAsDefaultLang =
    languageBuckets.length === DEFAULT_LANGUAGE_BUCKETS.length &&
    DEFAULT_LANGUAGE_BUCKETS.every((b) => languageBuckets.includes(b));
  if (!isSameAsDefaultLang) {
    const langNames: Record<string, string> = { en: "English", fr: "French", other: "Other" };
    hints.push(`Language filter: ${languageBuckets.map((b) => langNames[b] ?? b).join(", ")} only`);
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
  activeFilterHints?: string[],
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
  message: string,
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
): Promise<GenerateSchedulesResult | null> {
  if (input.mode === "basic") {
    return await handleBasicGeneration(input, cache);
  }

  const {
    remainingRequirements,
    requirementTreeWithStatus,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    constrainedPerRequirement: rawConstrainedPerRequirement,
    coursesThisSemester,
    completedCourses,
    prereqEligibleCourses,
    unassignedCompletedCourses,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    professorRatings,
    currentSeed,
    firstSeed,
    includeClosedComponents,
    virtualSectionsOnly,
    generationLimitFirstYearCredits,
    generationCompressedSchedule,
    generationPreferEasier,
    program,
    frenchImmersionStream,
  } = input;

  const unassigned = [...new Set(unassignedCompletedCourses)].sort();
  if (unassigned.length > 0) {
    const previewLimit = 12;
    const preview = unassigned.slice(0, previewLimit);
    const suffix =
      unassigned.length > previewLimit ? ` (+${unassigned.length - previewLimit} more)` : "";
    return {
      currentSchedule: null,
      swapPool: [],
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState(
        `You have ${unassigned.length} completed course${
          unassigned.length === 1 ? "" : "s"
        } not assigned to a requirement: ${preview.join(", ")}${suffix}. ` +
          `You must assign ${
            unassigned.length === 1 ? "it" : "them"
          } to requirements, or move them to the Excluded section.`,
      ),
    };
  }

  // Detect missing option group selections before running generation
  const missingOptionGroups: string[] = [];
  function walkNodes(
    nodes: RequirementWithStatus[],
    parentRequirementId: string | undefined,
    parentSelectedIndex: number | undefined,
    parentChildIndex: number | undefined,
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
  walkNodes(requirementTreeWithStatus, undefined, undefined, undefined);

  if (missingOptionGroups.length > 0) {
    return {
      currentSchedule: null,
      swapPool: [],
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState(
        "Complete Assign requirements before generating schedules.",
      ),
    };
  }

  const completedFirstYearCredits = completedCourses.reduce((sum, code) => {
    const m = code.match(/\d{4}/);
    if (!m || Number(m[0]) >= 2000) return sum;
    const course = cache.getCourse(code);
    return sum + (course?.credits ?? 3);
  }, 0);

  const constraints: GenerationConstraints = {
    minStartMinutes: generationMinStartMinutes,
    maxEndMinutes: generationMaxEndMinutes,
    allowedDays: generationAllowedDays,
    minProfessorRating: generationMinProfessorRating ?? undefined,
    professorRatings: professorRatings ?? undefined,
    maxFirstYearCredits: generationLimitFirstYearCredits
      ? 48 - (completedFirstYearCredits ?? 0)
      : undefined,
    compressedSchedule: generationCompressedSchedule,
  };

  const result = generateAdvancedSchedule({
    cache,
    constraints,
    completedCourses,
    prereqEligibleCourses,
    remainingRequirements,
    requirementTreeWithStatus,
    constrainedPerRequirementRaw: rawConstrainedPerRequirement,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    coursesThisSemester,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    generationPreferEasier,
    frenchImmersionStream,
    programTitle: program?.title,
    blacklistedCourses: input.blacklistedCourses ?? [],
    currentSeed,
    firstSeed,
  });

  const { schedule: foundSchedule, filteredOptionalPool, pinned, poolDiagnostics } = result;

  const filterHints = buildActiveFilterHints({
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    virtualSectionsOnly,
    includeClosedComponents,
    languageBuckets,
  });

  const optionalSlotsNeeded = coursesThisSemester - pinned.length;
  if (filteredOptionalPool.length < optionalSlotsNeeded) {
    const swapPool = [...new Set([...pinned, ...filteredOptionalPool])];
    return {
      currentSchedule: null,
      swapPool,
      chosenCourseToRequirementId: {},
      currentPoolMap: {},
      currentColorMap: {},
      generationError: generationErrorState("Not enough courses match your filters.", {
        emptyPools: poolDiagnostics?.emptyPools ?? [],
        totalAvailable: poolDiagnostics?.totalAvailable ?? swapPool.length,
        totalNeeded: poolDiagnostics?.totalNeeded ?? coursesThisSemester,
        timetableFailure: null as unknown as TimetableFailureDiagnostics,
        activeFilterHints: filterHints,
      }),
    };
  }

  if (!foundSchedule) {
    const diagCache = cacheWithClosedFilter(cache, includeClosedComponents, false);
    const { details, timetableFailure } = buildTimetableFailureDiagnostics(
      poolDiagnostics,
      pinned,
      filteredOptionalPool,
      coursesThisSemester,
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
      generationError: generationErrorState(timetableFailure.leadMessage, details),
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
): Promise<GenerateSchedulesResult | null> {
  const {
    basicPinnedCourses,
    basicElectivesCount,
    basicExcludedCategories,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    professorRatings,
    currentSeed,
    firstSeed,
    includeClosedComponents,
    virtualSectionsOnly,
    generationPreferEasier,
    completedCourses,
    studentPrograms,
    program,
    frenchImmersionStream,
    blacklistedCourses: basicBlacklistedCourses,
  } = input;

  const constraints: GenerationConstraints = {
    minStartMinutes: generationMinStartMinutes,
    maxEndMinutes: generationMaxEndMinutes,
    allowedDays: generationAllowedDays,
    minProfessorRating: generationMinProfessorRating ?? undefined,
    professorRatings: professorRatings ?? undefined,
  };

  const { schedule, optionalPool } = generateBasicSchedule({
    cache,
    constraints,
    pinned: basicPinnedCourses,
    completedCourses,
    studentPrograms,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    basicExcludedCategories,
    basicElectivesCount,
    includeClosedComponents,
    virtualSectionsOnly,
    generationPreferEasier,
    frenchImmersionStream,
    programTitle: program?.title,
    blacklistedCourses: basicBlacklistedCourses ?? [],
    currentSeed,
    firstSeed,
  });

  const swapPool = [...new Set([...basicPinnedCourses, ...optionalPool])];

  if (!schedule) {
    const timetableFailure = diagnoseTimetableFailure({
      pinnedCourseCodes: basicPinnedCourses,
      optionalCourseCodes: optionalPool,
      targetCount: basicPinnedCourses.length + basicElectivesCount,
      cache: cacheWithPerCourseVirtualFilter(
        cache,
        includeClosedComponents,
        (code) =>
          virtualSectionsOnly &&
          !new Set(basicPinnedCourses.map(normalizeCourseCode)).has(normalizeCourseCode(code)),
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
        message: timetableFailure.leadMessage,
        details: {
          emptyPools: [],
          totalAvailable: basicPinnedCourses.length + optionalPool.length,
          totalNeeded: basicPinnedCourses.length + basicElectivesCount,
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
