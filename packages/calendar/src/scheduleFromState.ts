/**
 * Reconstructs a GeneratedSchedule from a DecodedState + DataCache.
 *
 * Runs the requirements engine to derive candidateCourses per pool, applies
 * the same seeded-RNG pool-pick algorithm the web app uses, then calls
 * generateSchedulesWithPinned and applies any stored swaps.
 *
 * Used by:
 *  - packages/calendar/src/reconstruct.ts  (OG image worker)
 *  - apps/web  (initial schedule display when loading from a shared URL)
 */

import {
  type DataCache,
  type DecodedState,
  type GeneratedSchedule,
  type GenerationConstraints,
  computeRequirementsState,
  requirementIdsFromTree,
  buildPrereqContext,
  canTakeCourse,
  courseMatchesFilters,
  normalizeCourseCode,
  getEffectiveSchedule,
  getValidSectionCombos,
  getEnrollmentsForCourse,
  enrollmentsOverlap,
  generateSchedulesWithPinned,
  createSeededRng,
  prerequisitesContainNonCourse,
  mergeGlobalExplicitRule,
  isGroupToken,
  isHonoursProject,
  // pool helpers (moved from web app's scheduleHelpers)
  buildRequirementPools,
  computeCoursesPerPool,
  enumerateSingleRedistributions,
  buildPoolCaps,
  isBroadElectivePoolType,
  isElectiveRequirementType,
  isWithinElectiveLevelCap,
  isWithinElectiveLevelBuckets,
  virtualScheduleFilterApplies,
  shuffleInPlace,
  weightedRandomPick,
  courseLevelSortKey,
  candidatePoolWeight,
  type RequirementPool,
  // basic mode helpers
  cacheWithPerCourseVirtualFilter,
  courseAPlusPercent,
  analyzeFrenchImmersionProgress,
  frenchImmersionHeuristicPickWeight,
  programTitleIndicatesNursing,
  type FrenchImmersionProgressOptions,
} from "@uoplan/schedule";

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
 * Generates a schedule from a decoded URL state. This is the canonical
 * implementation shared between the web app and the worker.
 */
export function generateScheduleFromDecodedState(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  if (decoded.wizardMode === "basic") {
    return generateBasicSchedule(decoded, cache, constraints);
  }
  return generateAdvancedSchedule(decoded, cache, constraints);
}

const EASIER_APLUS_PIVOT = 20;
const EASIER_APLUS_BASE = 5.25;
const EASIER_APLUS_SCALE = 10;

function reorderOptionalPoolForBasic(
  codes: string[],
  cache: DataCache,
  rng: () => number,
  options: {
    preferEasier: boolean;
    frenchImmersionStream: boolean;
    immersionOpts?: FrenchImmersionProgressOptions;
    immersionProgressBaseCodes: readonly string[];
  },
): void {
  if (codes.length <= 1) return;
  const { preferEasier, frenchImmersionStream, immersionOpts, immersionProgressBaseCodes } =
    options;

  if (!preferEasier && !frenchImmersionStream) {
    shuffleInPlace(codes, rng);
    return;
  }

  const easierMemo = new Map<string, number>();
  function easierWeight(code: string): number {
    if (!preferEasier) return 1;
    let w = easierMemo.get(code);
    if (w !== undefined) return w;
    const sched = cache.getSchedule(code);
    const aPlus = sched ? courseAPlusPercent(sched) : null;
    w =
      aPlus == null
        ? 1
        : Math.pow(EASIER_APLUS_BASE, (aPlus - EASIER_APLUS_PIVOT) / EASIER_APLUS_SCALE);
    easierMemo.set(code, w);
    return w;
  }

  const progSnapshot =
    frenchImmersionStream && immersionOpts != null
      ? analyzeFrenchImmersionProgress(
          [...new Set(immersionProgressBaseCodes.map((c) => normalizeCourseCode(c)))],
          cache,
          immersionOpts,
        )
      : null;

  const remaining = [...codes];
  codes.length = 0;
  while (remaining.length > 0) {
    const weights = remaining.map((code) => {
      let w = easierWeight(code);
      if (progSnapshot) {
        w *= frenchImmersionHeuristicPickWeight(progSnapshot, code, cache);
      }
      return w;
    });
    const picked = weightedRandomPick(remaining, weights, rng);
    codes.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
}

function generateBasicSchedule(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  const pinned = decoded.basicPinnedCourses;
  const pinnedNormalized = new Set(pinned.map(normalizeCourseCode));

  const effectiveCache = cacheWithPerCourseVirtualFilter(
    cache,
    decoded.includeClosedComponents,
    (code) =>
      (decoded.virtualSectionsOnly ?? false) && !pinnedNormalized.has(normalizeCourseCode(code)),
  );

  const seed = decoded.currentSeed || decoded.firstSeed;
  const rng = createSeededRng(seed >>> 0);

  const targetCount = pinned.length + decoded.basicElectivesCount;

  const blacklistedSet = new Set(decoded.blacklistedCourses.map(normalizeCourseCode));
  const excludedPrefixes = (decoded.basicExcludedCategories ?? []).map((c) => c.toLowerCase());
  const filters = { levels: decoded.levelBuckets, languageBuckets: decoded.languageBuckets };

  const prereqCtx = buildPrereqContext(
    decoded.completedCourseCodes,
    effectiveCache,
    decoded.studentPrograms,
  );

  const optionalPool: string[] = [];
  for (const course of cache.getAllCourses()) {
    const code = course.code;
    if (!courseMatchesFilters(code, filters)) continue;
    if (!isWithinElectiveLevelBuckets(code, decoded.electiveLevelBuckets)) continue;

    const prefixMatch = code.match(/^([A-Z]{3,4})/i);
    const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
    if (excludedPrefixes.includes(prefix)) continue;

    if (decoded.completedCourseCodes.length > 0) {
      if (course.prerequisites) {
        if (!canTakeCourse(code, effectiveCache, prereqCtx)) continue;
      } else if (course.prereqText) {
        continue;
      }
    } else {
      if (course.prerequisites || course.prereqText) continue;
    }

    if (pinned.includes(code)) continue;
    if (blacklistedSet.has(normalizeCourseCode(code))) continue;

    const sched = effectiveCache.getSchedule(code);
    if (!sched) continue;
    if (getValidSectionCombos(sched, constraints).length === 0) continue;

    optionalPool.push(code);
  }

  const immersionOpts: FrenchImmersionProgressOptions | undefined = decoded.frenchImmersionStream
    ? { isNursingProgram: programTitleIndicatesNursing(decoded.program?.title) }
    : undefined;

  reorderOptionalPoolForBasic(optionalPool, effectiveCache, rng, {
    preferEasier: decoded.generationPreferEasier ?? false,
    frenchImmersionStream: decoded.frenchImmersionStream ?? false,
    immersionOpts,
    immersionProgressBaseCodes: [...decoded.completedCourseCodes, ...pinned],
  });

  const batch = generateSchedulesWithPinned(
    pinned,
    optionalPool,
    targetCount,
    effectiveCache,
    constraints,
    1,
  );
  if (batch.length === 0) return null;

  return applySwaps(batch[0], decoded, cache, constraints);
}

function buildOptionSelectionsMap(
  decoded: DecodedState,
  reqIndexToId: Map<number, string>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const { reqIndex, optionIndex } of decoded.optionSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) result[reqId] = optionIndex;
  }
  return result;
}

function buildConstrainedPerRequirement(
  decoded: DecodedState,
  reqIndexToId: Map<number, string>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of decoded.constrainedSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    if (courseCodes.length) result[reqId] = courseCodes;
  }
  for (const { reqIndex, groupPrefixes } of decoded.constrainedGroupSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    const existing = result[reqId] ?? [];
    result[reqId] = [...existing, ...groupPrefixes.map((p) => `__group__${p}`)];
  }
  return result;
}

function generateAdvancedSchedule(
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  const program = decoded.program;
  if (!program) return null;

  const seed = decoded.currentSeed || decoded.firstSeed;
  const rng = createSeededRng(seed >>> 0);

  // Two-pass requirement computation to resolve option selections.
  const firstPass = computeRequirementsState(program, decoded.completedCourseCodes, cache);
  const reqIds = requirementIdsFromTree(firstPass.tree);
  const reqIndexToId = new Map<number, string>(reqIds.map((id, i) => [i, id]));

  const selectedOptionsPerReq = buildOptionSelectionsMap(decoded, reqIndexToId);
  const constrainedPerReq = buildConstrainedPerRequirement(decoded, reqIndexToId);

  const { remaining } = computeRequirementsState(
    program,
    decoded.completedCourseCodes,
    cache,
    selectedOptionsPerReq,
  );

  const completedSet = new Set(decoded.completedCourseCodes.map(normalizeCourseCode));
  const blacklistedSet = new Set(decoded.blacklistedCourses.map(normalizeCourseCode));

  const ctx = buildPrereqContext(decoded.completedCourseCodes, cache, decoded.studentPrograms);
  const candidateSet = new Set<string>();
  for (const req of remaining) {
    for (const code of req.candidateCourses ?? []) candidateSet.add(code);
  }
  for (const course of cache.getAllCourses()) candidateSet.add(course.code);
  const prereqEligibleSet = new Set<string>();
  for (const code of candidateSet) {
    if (canTakeCourse(code, cache, ctx)) prereqEligibleSet.add(code);
  }

  const filters = {
    levels: decoded.levelBuckets,
    languageBuckets: decoded.languageBuckets,
  };

  const explicitExemptNormalized = new Set<string>();
  for (const codes of Object.values(constrainedPerReq)) {
    for (const code of codes) {
      if (!isGroupToken(code)) explicitExemptNormalized.add(normalizeCourseCode(code));
    }
  }

  // Build constrained (pinned) courses.
  const uniqueConstrained = [...new Set(Object.values(constrainedPerReq).flat())];
  const explicitUnion: string[] = [];
  const explicitSet = new Set<string>();
  for (const code of uniqueConstrained) {
    if (isGroupToken(code)) continue;
    if (isHonoursProject(code, cache)) continue;
    if (
      !getEffectiveSchedule(cache, code, decoded.includeClosedComponents, false) ||
      completedSet.has(normalizeCourseCode(code)) ||
      !prereqEligibleSet.has(code)
    ) {
      continue;
    }
    if (!explicitSet.has(code)) {
      explicitSet.add(code);
      explicitUnion.push(code);
    }
  }

  const { pinAllExplicit, explicitOnly } = mergeGlobalExplicitRule(
    explicitUnion.length,
    decoded.coursesThisSemester,
  );

  const pinned: string[] = [];
  if (pinAllExplicit) {
    for (const code of explicitUnion) {
      if (!pinned.includes(code)) pinned.push(code);
    }
  }

  function requirementIdForPinnedCourse(code: string): string | undefined {
    const norm = normalizeCourseCode(code);
    for (const [reqId, codes] of Object.entries(constrainedPerReq)) {
      if (codes.some((c) => !isGroupToken(c) && normalizeCourseCode(c) === norm)) return reqId;
    }
    return undefined;
  }

  const requirementTypeById = new Map<string, string | undefined>();

  function isEligibleCandidate(code: string, poolType?: string): boolean {
    const virtualOnly = virtualScheduleFilterApplies(
      decoded.virtualSectionsOnly,
      poolType,
      code,
      explicitExemptNormalized,
    );
    const sched = getEffectiveSchedule(cache, code, decoded.includeClosedComponents, virtualOnly);
    if (
      !sched ||
      pinned.includes(code) ||
      completedSet.has(normalizeCourseCode(code)) ||
      !prereqEligibleSet.has(code) ||
      !courseMatchesFilters(code, filters)
    ) {
      return false;
    }
    if (isHonoursProject(code, cache)) return false;
    if (isElectiveRequirementType(poolType) && !isWithinElectiveLevelCap(code)) return false;
    if (getValidSectionCombos(sched, constraints).length === 0) return false;
    if (blacklistedSet.has(normalizeCourseCode(code))) return false;
    return true;
  }

  const remainingNeeded = Math.max(0, decoded.coursesThisSemester - pinned.length);

  if (remainingNeeded === 0) {
    const schedules = generateSchedulesWithPinned(
      pinned,
      [],
      decoded.coursesThisSemester,
      cache,
      constraints,
      1,
    );
    return applySwaps(schedules[0] ?? null, decoded, cache, constraints);
  }

  const allPools = buildRequirementPools(remaining);

  let pools: RequirementPool[] = allPools
    .map((pool) => {
      const constrainedForPool = constrainedPerReq[pool.requirementId] ?? [];
      let pinnedCredits = 0;
      for (const code of pinned) {
        const primaryReqId = requirementIdForPinnedCourse(code);
        if (primaryReqId != null) {
          if (pool.requirementId !== primaryReqId) continue;
          pinnedCredits += cache.getCourse(code)?.credits ?? 3;
          continue;
        }
        if (!pool.candidateCourses.includes(code) && !constrainedForPool.includes(code)) continue;
        pinnedCredits += cache.getCourse(code)?.credits ?? 3;
      }
      const remainingCredits = Math.max(0, pool.creditsNeeded - pinnedCredits);
      requirementTypeById.set(pool.requirementId, pool.type as string);
      return { ...pool, creditsNeeded: remainingCredits };
    })
    .filter((pool) => pool.creditsNeeded > 0);

  pools = pools.filter((pool) => {
    if (pool.type !== "course" && pool.type !== "or_course") return true;
    return pool.candidateCourses.some(
      (code) =>
        !isHonoursProject(code, cache) &&
        !!getEffectiveSchedule(
          cache,
          code,
          decoded.includeClosedComponents,
          virtualScheduleFilterApplies(
            decoded.virtualSectionsOnly,
            pool.type as string,
            code,
            explicitExemptNormalized,
          ),
        ),
    );
  });

  const candidatesByRequirement = new Map<string, string[]>();
  for (const pool of pools) {
    const candidates: string[] = [];
    for (const code of pool.candidateCourses) {
      const sched = getEffectiveSchedule(
        cache,
        code,
        decoded.includeClosedComponents,
        virtualScheduleFilterApplies(
          decoded.virtualSectionsOnly,
          pool.type as string,
          code,
          explicitExemptNormalized,
        ),
      );
      if (
        !sched ||
        pinned.includes(code) ||
        decoded.completedCourseCodes.includes(code) ||
        !prereqEligibleSet.has(code) ||
        !courseMatchesFilters(code, filters)
      ) {
        continue;
      }
      if (isElectiveRequirementType(pool.type as string) && !isWithinElectiveLevelCap(code))
        continue;
      if (decoded.electiveLevelBuckets.length > 0 && isBroadElectivePoolType(pool.type as string)) {
        if (!isWithinElectiveLevelBuckets(code, decoded.electiveLevelBuckets)) continue;
      }
      if (isHonoursProject(code, cache)) continue;
      if (getValidSectionCombos(sched, constraints).length === 0) continue;
      if (blacklistedSet.has(normalizeCourseCode(code))) continue;
      candidates.push(code);
    }
    if (candidates.length > 0) candidatesByRequirement.set(pool.requirementId, candidates);
  }

  pools = pools.filter((p) => candidatesByRequirement.has(p.requirementId));

  const coursesPerPool = computeCoursesPerPool(pools, remainingNeeded, cache);
  const poolCaps = buildPoolCaps(pools);
  const redistributionAlts = enumerateSingleRedistributions(coursesPerPool, pools, poolCaps);

  type PoolPickResult = { ok: true; chosenFromPool: Record<string, string> } | { ok: false };

  function runPoolPickPass(perPoolNeed: Map<string, number>): PoolPickResult {
    const chosenCodes = new Set<string>(pinned);
    const chosenFromPool: Record<string, string> = {};

    const remaining = new Map<string, number>();
    for (const pool of pools) {
      const n = perPoolNeed.get(pool.requirementId) ?? 0;
      if (n > 0) remaining.set(pool.requirementId, n);
    }

    const totalRemaining = (): number => [...remaining.values()].reduce((a, b) => a + b, 0);

    for (const pool of pools) {
      const r = remaining.get(pool.requirementId) ?? 0;
      if (r <= 0) continue;
      const constrainedForPool = (constrainedPerReq[pool.requirementId] ?? []).filter(
        (c) => !isGroupToken(c),
      );
      const S = constrainedForPool.filter((code) => isEligibleCandidate(code, pool.type as string));
      const sSet = new Set(S);
      const candidates = candidatesByRequirement.get(pool.requirementId) ?? [];
      const G = candidates.filter((code) => !sSet.has(code));
      const SAvail = S.filter((code) => !chosenCodes.has(code));
      let GAvail = G.filter((code) => !chosenCodes.has(code));
      if (explicitOnly) GAvail = GAvail.filter((code) => explicitSet.has(code));
      const needS = Math.min(r, SAvail.length);
      const needG = r - needS;
      if (needG > GAvail.length) return { ok: false };
    }

    while (totalRemaining() > 0) {
      const cands: { pool: RequirementPool; code: string; weight: number }[] = [];

      for (const pool of pools) {
        const r = remaining.get(pool.requirementId) ?? 0;
        if (r <= 0) continue;
        const constrainedForPool = (constrainedPerReq[pool.requirementId] ?? []).filter(
          (c) => !isGroupToken(c),
        );
        const S = constrainedForPool.filter((code) =>
          isEligibleCandidate(code, pool.type as string),
        );
        const sSet = new Set(S);
        const candidates = candidatesByRequirement.get(pool.requirementId) ?? [];
        const G = candidates.filter((code) => !sSet.has(code));
        const SAvail = S.filter((code) => !chosenCodes.has(code));
        let GAvail = G.filter((code) => !chosenCodes.has(code));
        if (explicitOnly) GAvail = GAvail.filter((code) => explicitSet.has(code));
        const needS = Math.min(r, SAvail.length);
        const pickFromS = needS > 0;
        const list = pickFromS ? SAvail : GAvail;
        if (list.length === 0) continue;

        const levelCounts = new Map<number, number>();
        for (const code of list) {
          const lv = courseLevelSortKey(code);
          levelCounts.set(lv, (levelCounts.get(lv) ?? 0) + 1);
        }

        for (const code of list) {
          const level = courseLevelSortKey(code);
          const hasNonCoursePrereq = prerequisitesContainNonCourse(
            cache.getCourse(code)?.prerequisites,
          );
          const bucketSize = levelCounts.get(level) ?? 1;
          cands.push({
            pool,
            code,
            weight: candidatePoolWeight(level, hasNonCoursePrereq) / bucketSize,
          });
        }
      }

      if (cands.length === 0) break;

      const picked = weightedRandomPick(
        cands,
        cands.map((c) => c.weight),
        rng,
      );
      chosenCodes.add(picked.code);
      chosenFromPool[picked.code] = picked.pool.requirementId;
      const prev = remaining.get(picked.pool.requirementId) ?? 0;
      remaining.set(picked.pool.requirementId, prev - 1);
    }

    if (totalRemaining() > 0) return { ok: false };
    return { ok: true, chosenFromPool };
  }

  const maxAttempts = 300;
  const seenCourseSets = new Set<string>();
  let foundSchedule: GeneratedSchedule | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (foundSchedule) break;

    for (const list of candidatesByRequirement.values()) {
      shuffleInPlace(list, rng);
    }

    const allocationPool =
      redistributionAlts.length > 0 ? [coursesPerPool, ...redistributionAlts] : [coursesPerPool];
    const firstAlloc = allocationPool[Math.floor(rng() * allocationPool.length)];

    let pickPass: PoolPickResult = runPoolPickPass(firstAlloc);
    if (!pickPass.ok) {
      if (firstAlloc !== coursesPerPool) pickPass = runPoolPickPass(coursesPerPool);
      if (!pickPass.ok) {
        for (const alt of redistributionAlts) {
          if (alt === firstAlloc) continue;
          pickPass = runPoolPickPass(alt);
          if (pickPass.ok) break;
        }
      }
    }
    if (!pickPass.ok) continue;

    const { chosenFromPool } = pickPass;
    const chosenCodes = new Set<string>(pinned);
    for (const code of Object.keys(chosenFromPool)) chosenCodes.add(code);

    const optionalPool = Array.from(chosenCodes).filter((code) => !pinned.includes(code));
    const slotsFromOptional = decoded.coursesThisSemester - pinned.length;
    if (optionalPool.length < slotsFromOptional) continue;

    shuffleInPlace(optionalPool, rng);

    const batch =
      pinned.length === 0
        ? generateSchedulesWithPinned(
            optionalPool,
            [],
            decoded.coursesThisSemester,
            cache,
            constraints,
            1,
          )
        : generateSchedulesWithPinned(
            pinned,
            optionalPool,
            decoded.coursesThisSemester,
            cache,
            constraints,
            1,
          );

    if (batch.length > 0) {
      const fingerprint = batch[0].enrollments
        .map((e) => e.courseCode)
        .sort()
        .join(",");
      if (!seenCourseSets.has(fingerprint)) {
        seenCourseSets.add(fingerprint);
        foundSchedule = batch[0];
      }
    }
  }

  return applySwaps(foundSchedule, decoded, cache, constraints);
}

function applySwaps(
  schedule: GeneratedSchedule | null,
  decoded: DecodedState,
  cache: DataCache,
  constraints: GenerationConstraints,
): GeneratedSchedule | null {
  if (!schedule) return null;
  for (const swap of decoded.swaps) {
    const result = applyOneSwap(
      schedule,
      swap.enrollmentIndex,
      swap.courseCode,
      cache,
      constraints,
    );
    if (result) schedule = result;
  }
  return schedule;
}
