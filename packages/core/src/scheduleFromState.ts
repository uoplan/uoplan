import type { DataCache, DecodedState, GeneratedSchedule, GenerationConstraints } from "./index";
import {
  computeRequirementsState,
  requirementIdsFromTree,
  buildPrereqContext,
  canTakeCourse,
  getEffectiveSchedule,
  getValidSectionCombos,
  getEnrollmentsForCourse,
  enrollmentsOverlap,
  buildCourseDifficultyIndexFromCache,
  buildColorMap,
  transferSwapColor,
} from "./index";
import { generateBasicSchedule, generateAdvancedSchedule } from "./generateSchedule";

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

  const combos = getValidSectionCombos(scheduleData, constraints);
  const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);

  for (const combo of combos) {
    const candidate = getEnrollmentsForCourse(scheduleData, combo);
    if (!others.some((e) => enrollmentsOverlap(e, candidate))) {
      const newEnrollments = [...schedule.enrollments];
      newEnrollments[enrollmentIndex] = candidate;
      return { enrollments: newEnrollments };
    }
  }
  return null;
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

/**
 * Reconstructs a GeneratedSchedule from a DecodedState + DataCache using the
 * canonical generation algorithm shared with the web app.
 */
export function generateScheduleFromDecodedState(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): ReconstructedPreview | null {
  const courseDifficultyIndex = buildCourseDifficultyIndexFromCache(cache);
  if (decoded.wizardMode === "basic") {
    const result = generateBasicSchedule({
      cache,
      constraints,
      pinned: decoded.basicPinnedCourses,
      completedCourses: decoded.completedCourseCodes,
      studentPrograms: decoded.studentPrograms,
      levelBuckets: decoded.levelBuckets,
      languageBuckets: decoded.languageBuckets,
      electiveLevelBuckets: decoded.electiveLevelBuckets,
      basicExcludedCategories: decoded.basicExcludedCategories ?? [],
      basicElectivesCount: decoded.basicElectivesCount,
      includeClosedComponents: decoded.includeClosedComponents,
      virtualSectionsOnly: decoded.virtualSectionsOnly ?? false,
      generationPreferEasier: decoded.generationPreferEasier ?? false,
      courseDifficultyIndex,
      frenchImmersionStream: decoded.frenchImmersionStream ?? false,
      programTitle: decoded.program?.title,
      blacklistedCourses: decoded.blacklistedCourses,
      currentSeed: decoded.currentSeed,
      firstSeed: decoded.firstSeed,
    });
    return applySwaps(result.schedule, decoded, cache, constraints);
  }

  // Advanced mode
  const program = decoded.program;
  if (!program) return null;

  // First pass: build requirement tree so we can map index → requirement ID
  const firstPass = computeRequirementsState(program, decoded.completedCourseCodes, cache);
  const reqIds = requirementIdsFromTree(firstPass.tree);
  const reqIndexToId = new Map<number, string>(reqIds.map((id, i) => [i, id]));

  // Map option selections (encoded by index) to requirement IDs
  const selectedOptionsPerRequirement: Record<string, number> = {};
  for (const { reqIndex, optionIndex } of decoded.optionSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) selectedOptionsPerRequirement[reqId] = optionIndex;
  }

  // Map constrained selections to requirement IDs (group tokens use "group:PREFIX" format)
  const constrainedPerRequirementRaw: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of decoded.constrainedSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    if (courseCodes.length) constrainedPerRequirementRaw[reqId] = courseCodes;
  }
  for (const { reqIndex, groupPrefixes } of decoded.constrainedGroupSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    const existing = constrainedPerRequirementRaw[reqId] ?? [];
    constrainedPerRequirementRaw[reqId] = [...existing, ...groupPrefixes.map((p) => `group:${p}`)];
  }

  // Map course selections to requirement IDs
  const selectedPerRequirement: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of decoded.courseSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) selectedPerRequirement[reqId] = courseCodes;
  }

  // Build prereq-eligible courses
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

  const result = generateAdvancedSchedule({
    cache,
    constraints,
    completedCourses: decoded.completedCourseCodes,
    prereqEligibleCourses,
    remainingRequirements: firstPass.remaining,
    requirementTreeWithStatus: firstPass.tree,
    constrainedPerRequirementRaw,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    coursesThisSemester: decoded.coursesThisSemester,
    levelBuckets: decoded.levelBuckets,
    languageBuckets: decoded.languageBuckets,
    electiveLevelBuckets: decoded.electiveLevelBuckets,
    includeClosedComponents: decoded.includeClosedComponents,
    virtualSectionsOnly: decoded.virtualSectionsOnly ?? false,
    generationPreferEasier: decoded.generationPreferEasier ?? false,
    courseDifficultyIndex,
    frenchImmersionStream: decoded.frenchImmersionStream ?? false,
    programTitle: decoded.program?.title,
    blacklistedCourses: decoded.blacklistedCourses,
    currentSeed: decoded.currentSeed,
    firstSeed: decoded.firstSeed,
  });

  return applySwaps(result.schedule, decoded, cache, constraints);
}
