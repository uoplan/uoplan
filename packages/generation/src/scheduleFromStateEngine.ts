import type { DataCache } from "@uoplan/domain/dataCache";
import type { GeneratedSchedule, GenerationConstraints } from "./generation/types";
import { firstFittingEnrollment } from "./generation/swap";
import {
  buildPrereqContext,
  canTakeCourse,
  computeRequirementsState,
  gateRemainingByPriority,
  requirementIdsFromTree,
} from "@uoplan/requirements";
import type { DecodedState } from "./decodedState";
import { getEffectiveSchedule } from "./scheduleFilters";
import { buildColorMap, transferSwapColor } from "./uiUtils";
import { runAdvancedGeneration, runBasicGeneration } from "./engineBridge";
import type { AdvancedRequestInput, BasicRequestInput, ScheduleEngine } from "./engineBridge";

export interface ReconstructedPreview {
  schedule: GeneratedSchedule;
  colorMap: Record<string, number>;
}

function applyOneSwap(
  schedule: GeneratedSchedule,
  enrollmentIndex: number,
  newCourseCode: string,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  const scheduleData = getEffectiveSchedule(cache, newCourseCode, false, false);
  if (!scheduleData) return null;

  const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);
  const candidate = firstFittingEnrollment(scheduleData, constraints, others);
  if (!candidate) return null;

  const newEnrollments = [...schedule.enrollments];
  newEnrollments[enrollmentIndex] = candidate;
  return { enrollments: newEnrollments };
}

/**
 * Replays the decoded swaps over the base schedule, carrying a colour map so the
 * OG-image preview matches the web calendar. Mirrors the web store's
 * `tryApplyOneSwap`: each successful swap transfers the old course's colour index
 * to the swapped-in course code. Failed swaps leave both schedule and colours
 * unchanged.
 */
function applySwaps(
  schedule: GeneratedSchedule | null,
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): ReconstructedPreview | null {
  if (!schedule) return null;
  let colorMap = buildColorMap(schedule);
  for (const swap of decoded.swaps) {
    const oldEnrollment = schedule.enrollments[swap.enrollmentIndex];
    if (!oldEnrollment) continue;
    const oldCode = oldEnrollment.courseCode;
    const result = applyOneSwap(
      schedule,
      swap.enrollmentIndex,
      swap.courseCode,
      cache,
      constraints,
    );
    if (!result) continue;
    schedule = result;
    colorMap = transferSwapColor(colorMap, oldCode, swap.courseCode);
  }
  return { schedule, colorMap };
}

function buildBasicInput(
  decoded: DecodedState,
  constraints: GenerationConstraints,
): BasicRequestInput {
  return {
    school: decoded.school,
    constraints,
    basketCourses: decoded.basketCourses,
    additionalElectivesCount: decoded.additionalElectivesCount,
    coursesThisSemester: decoded.coursesThisSemester,
    basicExcludedCategories: decoded.basicExcludedCategories ?? [],
    completedCourses: decoded.completedCourseCodes,
    studentPrograms: decoded.studentPrograms,
    levelBuckets: decoded.levelBuckets,
    languageBuckets: decoded.languageBuckets,
    electiveLevelBuckets: decoded.electiveLevelBuckets,
    includeClosedComponents: decoded.includeClosedComponents,
    virtualSectionsOnly: decoded.virtualSectionsOnly ?? false,
    optimizationPriorities: decoded.optimizationPriorities,
    frenchImmersionStream: decoded.frenchImmersionStream ?? false,
    blacklistedCourses: decoded.blacklistedCourses,
    currentSeed: decoded.currentSeed,
    firstSeed: decoded.firstSeed,
  };
}

type RequirementsState = ReturnType<typeof computeRequirementsState>;
type RequirementIndexToId = Map<number, string>;

function buildRequirementIndexToId(tree: RequirementsState["tree"]): RequirementIndexToId {
  const reqIds = requirementIdsFromTree(tree);
  return new Map<number, string>(reqIds.map((id, i) => [i, id]));
}

function buildSelectedOptionsPerRequirement(
  decoded: DecodedState,
  reqIndexToId: RequirementIndexToId,
): Record<string, number> {
  const selectedOptionsPerRequirement: Record<string, number> = {};
  for (const { reqIndex, optionIndex } of decoded.optionSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) selectedOptionsPerRequirement[reqId] = optionIndex;
  }
  return selectedOptionsPerRequirement;
}

function buildConstrainedPerRequirementRaw(
  decoded: DecodedState,
  reqIndexToId: RequirementIndexToId,
): Record<string, string[]> {
  const constrainedPerRequirementRaw: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of decoded.constrainedSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    if (courseCodes.length > 0) constrainedPerRequirementRaw[reqId] = courseCodes;
  }
  for (const { reqIndex, groupPrefixes } of decoded.constrainedGroupSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    const existing = constrainedPerRequirementRaw[reqId] ?? [];
    constrainedPerRequirementRaw[reqId] = [...existing, ...groupPrefixes.map((p) => `group:${p}`)];
  }
  return constrainedPerRequirementRaw;
}

function buildSelectedPerRequirement(
  decoded: DecodedState,
  reqIndexToId: RequirementIndexToId,
): Record<string, string[]> {
  const selectedPerRequirement: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of decoded.courseSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) selectedPerRequirement[reqId] = courseCodes;
  }
  return selectedPerRequirement;
}

function buildRequirementPriorities(
  decoded: DecodedState,
  reqIndexToId: RequirementIndexToId,
): Record<string, number> {
  const requirementPriorities: Record<string, number> = {};
  for (const { reqIndex, priority } of decoded.requirementPrioritySelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null && priority > 0) requirementPriorities[reqId] = priority;
  }
  return requirementPriorities;
}

function buildPrereqEligibleCourses(
  firstPass: RequirementsState,
  decoded: DecodedState,
  cache: DataCache,
): string[] {
  const ctx = buildPrereqContext(decoded.completedCourseCodes, cache, decoded.studentPrograms);
  const candidateSet = new Set<string>();
  for (const req of firstPass.remaining) {
    for (const code of req.candidateCourses ?? []) candidateSet.add(code);
  }
  for (const course of cache.getAllCourses()) candidateSet.add(course.code);
  const prereqEligibleCourses: string[] = [];
  for (const code of candidateSet) {
    if (canTakeCourse(code, cache, ctx)) prereqEligibleCourses.push(code);
  }
  return prereqEligibleCourses;
}

function buildAdvancedInput(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): AdvancedRequestInput | null {
  const program = decoded.program;
  if (!program) return null;

  const firstPass = computeRequirementsState(program, decoded.completedCourseCodes, cache);
  const reqIndexToId = buildRequirementIndexToId(firstPass.tree);
  const requirementPriorities = buildRequirementPriorities(decoded, reqIndexToId);

  return {
    school: decoded.school,
    constraints,
    completedCourses: decoded.completedCourseCodes,
    prereqEligibleCourses: buildPrereqEligibleCourses(firstPass, decoded, cache),
    remainingRequirements: gateRemainingByPriority(firstPass.remaining, requirementPriorities),
    requirementTreeWithStatus: firstPass.tree,
    constrainedPerRequirementRaw: buildConstrainedPerRequirementRaw(decoded, reqIndexToId),
    selectedPerRequirement: buildSelectedPerRequirement(decoded, reqIndexToId),
    selectedOptionsPerRequirement: buildSelectedOptionsPerRequirement(decoded, reqIndexToId),
    coursesThisSemester: decoded.coursesThisSemester,
    additionalElectivesCount: decoded.additionalElectivesCount,
    forcedCourses: decoded.basketCourses,
    levelBuckets: decoded.levelBuckets,
    languageBuckets: decoded.languageBuckets,
    electiveLevelBuckets: decoded.electiveLevelBuckets,
    includeClosedComponents: decoded.includeClosedComponents,
    virtualSectionsOnly: decoded.virtualSectionsOnly ?? false,
    optimizationPriorities: decoded.optimizationPriorities,
    frenchImmersionStream: decoded.frenchImmersionStream ?? false,
    basicExcludedCategories: [],
    blacklistedCourses: decoded.blacklistedCourses,
    currentSeed: decoded.currentSeed,
    firstSeed: decoded.firstSeed,
  };
}

/**
 * Reconstructs a {@link GeneratedSchedule} from a {@link DecodedState} by running
 * the shared Rust/WASM {@link ScheduleEngine}. The engine owns all generation;
 * this only builds the request inputs from the decoded wizard state (mirroring
 * the web app's request building) and replays the decoded swaps over the result.
 */
export function generateScheduleFromDecodedState(
  engine: ScheduleEngine,
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): ReconstructedPreview | null {
  if (decoded.wizardMode === "basic") {
    const { schedule } = runBasicGeneration(engine, buildBasicInput(decoded, constraints), cache);
    return applySwaps(schedule, decoded, cache, constraints);
  }

  const advancedInput = buildAdvancedInput(decoded, cache, constraints);
  if (!advancedInput) return null;
  const { schedule } = runAdvancedGeneration(engine, advancedInput, cache);
  return applySwaps(schedule, decoded, cache, constraints);
}
