import type { AppStore } from "../../types";
import type {
  CourseEnrollment,
  GenerationConstraints,
  NormalizedCourseCode,
  RequirementWithStatus,
} from "@uoplan/core";
import { SCHOOLS } from "@uoplan/domain/school";
import {
  buildPrereqContext,
  courseMatchesFilters,
  enrollmentsOverlap,
  getEffectiveSchedule,
  getEnrollmentsForCourse,
  getFirstOverlapWith,
  getValidSectionCombos,
  isElectiveRequirementType,
  isHonoursProject,
  isWithinElectiveLevelBuckets,
  isWithinElectiveLevelCap,
  normalizeCourseCode,
  virtualScheduleFilterApplies,
} from "@uoplan/core";
import {
  courseFitsAroundOthers,
  isSwapCandidateEligible,
} from "@uoplan/core/generation/swapCandidates";
import {
  applyOptionSelections,
  collectRequirementIdsWithCandidateCourse,
  courseMatchesElectiveLevelBuckets,
} from "../../requirements/selectionUtils";
import { buildExplicitExemptSet, buildSwapConstraints } from "./swapContext";

export function getSwapCandidates(
  enrollmentIndex: number,
  get: () => AppStore,
  validEnrollmentsByCourseCode: Map<string, CourseEnrollment[]>,
): ReturnType<AppStore["getSwapCandidates"]> {
  const {
    basketCourses,
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
    includeClosedComponents,
    virtualSectionsOnly,
    filteredPrereqEligibleCourses,
    constrainedPerRequirement,
    selectedPerRequirement,
    generationLimitFirstYearCredits,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    school,
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

  if (get().calendarMode === "basic") {
    if (basketCourses.includes(oldCode)) {
      return { candidates: [], poolCourses: [], rejectedWithConflict: [] };
    }

    const optionalPool: NormalizedCourseCode[] = [];
    const excludedPrefixes = basicExcludedCategories.map((c) => c.toLowerCase());
    const prereqCtx = buildPrereqContext(completedCourses, cache, studentPrograms);
    const basicFilters = { levels: levelBuckets, languageBuckets };
    const alreadyInSchedule = new Set(schedule.enrollments.map((e) => e.courseCode));
    const swapConstraints: GenerationConstraints = buildSwapConstraints(get());
    // The other courses keep their currently-assigned sections; a candidate is
    // feasible if it has at least one section combo that satisfies the time
    // constraints and doesn't overlap any of them. This mirrors the advanced
    // path (and the actual single-course swap) and avoids running a full WASM
    // re-timetable over every catalogue course, which made the popover take
    // seconds on large schedules.
    const others = schedule.enrollments.filter((_, i) => i !== enrollmentIndex);
    // Candidates are never pinned (skipped below), so the virtual-only filter
    // applies to them whenever it is enabled.
    const virtualOnly = virtualSectionsOnly;

    for (const course of cache.getAllCourses()) {
      const code = course.code;
      if (code === oldCode) continue;
      if (!courseMatchesFilters(code, basicFilters)) continue;
      if (!isWithinElectiveLevelBuckets(code, electiveLevelBuckets)) continue;
      if (
        !isSwapCandidateEligible(
          course,
          cache,
          prereqCtx,
          completedCourses.length > 0,
          excludedPrefixes,
        )
      )
        continue;
      if (basketCourses.includes(code)) continue;
      if (alreadyInSchedule.has(code)) continue;
      if (
        !courseFitsAroundOthers(
          cache,
          code,
          swapConstraints,
          includeClosedComponents,
          virtualOnly,
          others,
          validEnrollmentsByCourseCode,
        )
      )
        continue;

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
  const candidateSet = new Set<NormalizedCourseCode>();
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
      for (const c of req.candidateCourses) candidateSet.add(normalizeCourseCode(c));
    } else {
      const node = findReqNodeById(requirementTreeWithStatus, poolId);
      if (node?.candidateCourses?.length) {
        poolRequirementType = node.type;
        requirementTitle = node.title;
        for (const c of node.candidateCourses) candidateSet.add(normalizeCourseCode(c));
      }
    }
  }
  if (candidateSet.size === 0) {
    const oldCodeNorm = oldCode;
    // Search remaining requirements
    for (const req of remainingRequirements) {
      if (!req.candidateCourses?.length) continue;
      const hasOld = req.candidateCourses.some((c) => normalizeCourseCode(c) === oldCodeNorm);
      if (hasOld) {
        for (const c of req.candidateCourses) candidateSet.add(normalizeCourseCode(c));
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
          for (const c of node.candidateCourses) candidateSet.add(normalizeCourseCode(c));
        }
      }
    }
  }
  if (candidateSet.size === 0) {
    for (const c of filteredPrereqEligibleCourses) candidateSet.add(normalizeCourseCode(c));
  }

  const explicitExemptNormalized = buildExplicitExemptSet(
    constrainedPerRequirement,
    selectedPerRequirement,
  );

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
        return (
          sum + (cache.getCourse(code)?.credits ?? SCHOOLS[school].credits.defaultCourseCredits)
        );
      }, 0)
    : 0;
  const othersFirstYearCredits = generationLimitFirstYearCredits
    ? others.reduce((sum, e) => {
        if (!isFirstYear(e.courseCode)) return sum;
        return (
          sum +
          (cache.getCourse(e.courseCode)?.credits ?? SCHOOLS[school].credits.defaultCourseCredits)
        );
      }, 0)
    : 0;
  const remainingFirstYearBudget = generationLimitFirstYearCredits
    ? SCHOOLS[school].credits.firstYearCreditCap -
      completedFirstYearCredits -
      othersFirstYearCredits
    : Infinity;

  const prereqEligibleSet = new Set(prereqEligibleCourses);
  const swapConstraints: GenerationConstraints = buildSwapConstraints(get());

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

  const candidates: NormalizedCourseCode[] = [];
  const rejectedWithConflict: Array<{
    code: NormalizedCourseCode;
    conflictsWith: NormalizedCourseCode;
  }> = [];
  for (const code of candidateSet) {
    if (!prereqEligibleSet.has(code)) continue;
    if (code === oldCode) continue;
    if (completedCourses.includes(code)) continue;
    if (alreadyInSchedule.has(code)) continue;
    if (isHonoursProject(code, cache)) continue;
    if (!courseMatchesFilters(code, filters)) continue;
    if (
      isFirstYear(code) &&
      (cache.getCourse(code)?.credits ?? SCHOOLS[school].credits.defaultCourseCredits) >
        remainingFirstYearBudget
    )
      continue;

    const isElectiveType = isElectiveRequirementType(poolRequirementType);
    const isGenericElective =
      poolRequirementType === "free_elective" ||
      poolRequirementType === "non_discipline_elective" ||
      poolRequirementType === "faculty_elective" ||
      poolRequirementType === "elective";
    if (isElectiveType && !isWithinElectiveLevelCap(code)) continue;
    if (isGenericElective && !courseMatchesElectiveLevelBuckets(code, electiveLevelBuckets))
      continue;
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
}
