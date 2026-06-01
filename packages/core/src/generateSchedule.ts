/**
 * Shared schedule generation core used by both the web app (via AppState) and the
 * OG image worker (via DecodedState). Neither caller should duplicate this logic.
 */

import type {
  DataCache,
  GeneratedSchedule,
  GenerationConstraints,
  RemainingRequirement,
  RequirementWithStatus,
  RequirementPool,
  FrenchImmersionProgressOptions,
  CourseLevelBucket,
  CourseLanguageBucket,
  CourseDifficultyIndex,
} from "./index";
import {
  getValidSectionCombos,
  analyzeFrenchImmersionProgress,
  frenchImmersionHeuristicPickWeight,
  programTitleIndicatesNursing,
  isGroupToken,
  groupTokenPrefix,
  canonicalGroupToken,
  subjectPrefix,
  cacheWithClosedFilter,
  cacheWithPerCourseVirtualFilter,
  getEffectiveSchedule,
  courseMatchesFilters,
  normalizeCourseCode,
  buildPrereqContext,
  canTakeCourse,
  buildRequirementPools,
  computeCoursesPerPool,
  buildPoolCaps,
  enumerateSingleRedistributions,
  isBroadElectivePoolType,
  isElectiveRequirementType,
  isWithinElectiveLevelCap,
  isWithinElectiveLevelBuckets,
  virtualScheduleFilterApplies,
  shuffleInPlace,
  weightedRandomPick,
  courseLevelSortKey,
  candidatePoolWeight,
  createSeededRng,
  prerequisitesContainNonCourse,
  mergeGlobalExplicitRule,
  isHonoursProject,
} from "./index";
import { collectImplicitHonoursForSchedule } from "./implicitHonours";
import {
  buildTimetablePipeline,
  firstSeededArrangement,
  firstSeededSubsetArrangement,
} from "./engine/integration";

const EASIER_APLUS_PIVOT = 20;
const EASIER_APLUS_BASE = 5.25;
const EASIER_APLUS_SCALE = 10;

// Avalanche-mix a 32-bit integer so adjacent integer seeds map to distant
// points in the RNG space (splitmix32-style finalizer).
function scrambleSeed(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return n ^ (n >>> 16);
}

// ---------------------------------------------------------------------------
// Shared helpers (also exported so callers can use/test them)
// ---------------------------------------------------------------------------

function collectRequirementsFromSelectedBranches(
  nodes: RequirementWithStatus[],
  selectedOptions: Record<string, number>,
  existingIds: Set<string>,
): RemainingRequirement[] {
  const result: RemainingRequirement[] = [];
  for (const node of nodes) {
    if (node.complete) continue;
    const isOrLike = node.type === "or_group" || node.type === "options_group";
    if (isOrLike && node.requirementId != null) {
      const sel = selectedOptions[node.requirementId];
      if (sel != null && node.options?.[sel]) {
        result.push(
          ...collectRequirementsFromSelectedBranches(
            [node.options[sel]],
            selectedOptions,
            existingIds,
          ),
        );
      }
    } else {
      if (
        node.requirementId != null &&
        !existingIds.has(node.requirementId) &&
        node.candidateCourses?.length &&
        (node.creditsNeeded ?? 0) > 0
      ) {
        existingIds.add(node.requirementId);
        result.push({
          requirementId: node.requirementId,
          type: node.type,
          title: node.title,
          candidateCourses: node.candidateCourses,
          creditsNeeded: node.creditsNeeded,
          satisfiedBy: node.satisfiedBy ?? [],
        });
      }
      if (node.options?.length) {
        result.push(
          ...collectRequirementsFromSelectedBranches(node.options, selectedOptions, existingIds),
        );
      }
    }
  }
  return result;
}

export interface ExpandConstrainedResult {
  individualSelections: Record<string, string[]>;
  groupTokenSelections: Map<string, Map<string, number>>;
}

/**
 * Build the full requirement universe the advanced generator schedules against: the base remaining
 * requirements plus any requirements reachable through currently-selected option-group branches.
 * Exported so callers (warnings UI + generation adapter) can resolve desired courses against the
 * exact same set the engine uses, avoiding misclassification of branch-only courses.
 */
export function buildEffectiveRemainingRequirements(
  remainingRequirements: RemainingRequirement[],
  requirementTreeWithStatus: RequirementWithStatus[],
  selectedOptionsPerRequirement: Record<string, number>,
): RemainingRequirement[] {
  const existingIds = new Set(
    remainingRequirements.map((r) => r.requirementId).filter((id): id is string => id != null),
  );
  const branchRequirements = collectRequirementsFromSelectedBranches(
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    existingIds,
  );
  return [...remainingRequirements, ...branchRequirements];
}

export function expandConstrainedPerRequirement(
  raw: Record<string, string[]>,
): ExpandConstrainedResult {
  const individualSelections: Record<string, string[]> = {};
  const groupTokenSelections: Map<string, Map<string, number>> = new Map();

  for (const [reqId, codes] of Object.entries(raw)) {
    const individualExpanded = new Set<string>();
    const groupTokenCountMap = new Map<string, number>();

    for (const code of codes) {
      if (isGroupToken(code)) {
        const canonical = canonicalGroupToken(code);
        const currentCount = groupTokenCountMap.get(canonical) ?? 0;
        groupTokenCountMap.set(canonical, currentCount + 1);
      } else {
        individualExpanded.add(code);
      }
    }

    if (individualExpanded.size > 0) {
      individualSelections[reqId] = [...individualExpanded];
    }

    if (groupTokenCountMap.size > 0) {
      groupTokenSelections.set(reqId, groupTokenCountMap);
    }
  }

  return { individualSelections, groupTokenSelections };
}

export function buildPendingGroupPickCounts(
  groupTokenSelections: Map<string, Map<string, number>>,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [reqId, tokenMap] of groupTokenSelections) {
    const agg = new Map<string, number>();
    for (const [canonicalToken, count] of tokenMap.entries()) {
      if (count <= 0) continue;
      const pfx = groupTokenPrefix(canonicalToken);
      agg.set(pfx, (agg.get(pfx) ?? 0) + count);
    }
    if (agg.size > 0) out.set(reqId, agg);
  }
  return out;
}

function clonePendingGroupPickCounts(
  src: Map<string, Map<string, number>>,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of src) {
    out.set(k, new Map(v));
  }
  return out;
}

export function reorderOptionalPoolForGeneration(
  codes: string[],
  cache: DataCache,
  rng: () => number,
  options: {
    preferEasier: boolean;
    frenchImmersionStream: boolean;
    immersionOpts?: FrenchImmersionProgressOptions;
    immersionProgressBaseCodes: readonly string[];
    courseDifficultyIndex?: CourseDifficultyIndex;
  },
): void {
  const {
    preferEasier,
    frenchImmersionStream,
    immersionOpts,
    immersionProgressBaseCodes,
    courseDifficultyIndex,
  } = options;

  if (codes.length <= 1) return;

  if (!preferEasier && !frenchImmersionStream) {
    shuffleInPlace(codes, rng);
    return;
  }

  const easierMemo = new Map<string, number>();
  function easierWeight(code: string): number {
    if (!preferEasier) return 1;
    let w = easierMemo.get(code);
    if (w !== undefined) return w;
    const aPlus = courseDifficultyIndex ? courseDifficultyIndex(code) : null;
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
    const idx = remaining.indexOf(picked);
    remaining.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

export interface BasicScheduleParams {
  cache: DataCache;
  constraints: GenerationConstraints;
  pinned: string[];
  completedCourses: string[];
  studentPrograms: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  basicExcludedCategories: string[];
  basicElectivesCount: number;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  generationPreferEasier: boolean;
  /** Optional grade-difficulty signal for the "prefer easier" heuristic. */
  courseDifficultyIndex?: CourseDifficultyIndex;
  frenchImmersionStream: boolean;
  programTitle: string | undefined;
  blacklistedCourses: string[];
  currentSeed: number;
  firstSeed: number;
}

export interface BasicScheduleResult {
  schedule: GeneratedSchedule | null;
  optionalPool: string[];
}

export function generateBasicSchedule(params: BasicScheduleParams): BasicScheduleResult {
  const {
    cache,
    constraints,
    pinned,
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
    courseDifficultyIndex,
    frenchImmersionStream,
    programTitle,
    blacklistedCourses,
    currentSeed,
    firstSeed,
  } = params;

  const pinnedNormalized = new Set(pinned.map(normalizeCourseCode));
  const baseCache = cacheWithClosedFilter(cache, includeClosedComponents, false);
  const effectiveCache = cacheWithPerCourseVirtualFilter(
    cache,
    includeClosedComponents,
    (code) => virtualSectionsOnly && !pinnedNormalized.has(normalizeCourseCode(code)),
  );

  const effectiveSeed = currentSeed || firstSeed;
  const rng = createSeededRng(scrambleSeed(effectiveSeed) >>> 0);

  const targetCount = pinned.length + basicElectivesCount;

  const optionalPool: string[] = [];
  const blacklistedSet = new Set(blacklistedCourses.map(normalizeCourseCode));
  const excludedPrefixes = basicExcludedCategories.map((c) => c.toLowerCase());
  const filters = { levels: levelBuckets, languageBuckets };

  const prereqCtx = buildPrereqContext(completedCourses, baseCache, studentPrograms);

  for (const course of cache.getAllCourses()) {
    const code = course.code;
    if (!courseMatchesFilters(code, filters)) continue;
    if (!isWithinElectiveLevelBuckets(code, electiveLevelBuckets)) continue;

    const prefixMatch = code.match(/^([A-Z]{3,4})/i);
    const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
    if (excludedPrefixes.includes(prefix)) continue;

    if (completedCourses.length > 0) {
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

  const immersionOpts: FrenchImmersionProgressOptions | undefined = frenchImmersionStream
    ? { isNursingProgram: programTitleIndicatesNursing(programTitle) }
    : undefined;

  reorderOptionalPoolForGeneration(optionalPool, effectiveCache, rng, {
    preferEasier: generationPreferEasier,
    frenchImmersionStream,
    immersionOpts,
    immersionProgressBaseCodes: [...completedCourses, ...pinned],
    courseDifficultyIndex,
  });

  const timetablePipeline = buildTimetablePipeline(constraints);
  const arrangementRng = createSeededRng((scrambleSeed(effectiveSeed) ^ 0x9e3779b9) >>> 0);
  const schedule = firstSeededSubsetArrangement(
    pinned,
    optionalPool,
    targetCount,
    effectiveCache,
    timetablePipeline,
    arrangementRng,
  );

  return {
    schedule,
    optionalPool,
  };
}

// ---------------------------------------------------------------------------
// Advanced generation
// ---------------------------------------------------------------------------

export interface PoolDiagnostics {
  emptyPools: Array<{ label: string; requirementId?: string; candidateCourses?: string[] }>;
  totalAvailable: number;
  totalNeeded: number;
}

export interface AdvancedScheduleParams {
  cache: DataCache;
  constraints: GenerationConstraints;
  completedCourses: string[];
  prereqEligibleCourses: string[];
  remainingRequirements: RemainingRequirement[];
  requirementTreeWithStatus: RequirementWithStatus[];
  /** Raw constrained selections including group tokens (e.g. "group:CSI"). */
  constrainedPerRequirementRaw: Record<string, string[]>;
  selectedPerRequirement: Record<string, string[]>;
  selectedOptionsPerRequirement: Record<string, number>;
  coursesThisSemester: number;
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  generationPreferEasier: boolean;
  /** Optional grade-difficulty signal for the "prefer easier" heuristic. */
  courseDifficultyIndex?: CourseDifficultyIndex;
  frenchImmersionStream: boolean;
  programTitle: string | undefined;
  blacklistedCourses: string[];
  /**
   * Elective subject prefixes (e.g. "CSI") to exclude from BROAD elective pools only. Mirrors the
   * basic generator's `basicExcludedCategories`; scoped to broad-elective pools so it can never make
   * a required/explicit course pool unsatisfiable in advanced mode.
   */
  basicExcludedCategories?: string[];
  /**
   * Courses the user explicitly wants this term that did NOT map to any remaining requirement
   * (the unified "courses you want" list, standalone branch). They are force-pinned as their own
   * pool: scheduled unconditionally, bypassing requirement membership and prerequisite eligibility,
   * but still validated against schedule availability and section/time constraints.
   */
  forcedCourses?: string[];
  currentSeed: number;
  firstSeed: number;
}

export interface AdvancedScheduleResult {
  schedule: GeneratedSchedule | null;
  filteredOptionalPool: string[];
  pinned: string[];
  poolDiagnostics: PoolDiagnostics | null;
}

export function generateAdvancedSchedule(params: AdvancedScheduleParams): AdvancedScheduleResult {
  const {
    cache,
    constraints,
    completedCourses,
    prereqEligibleCourses,
    remainingRequirements,
    requirementTreeWithStatus,
    constrainedPerRequirementRaw,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    coursesThisSemester,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    generationPreferEasier,
    courseDifficultyIndex,
    frenchImmersionStream,
    programTitle,
    blacklistedCourses,
    basicExcludedCategories = [],
    forcedCourses = [],
    currentSeed,
    firstSeed,
  } = params;

  const effectiveSeed = currentSeed || firstSeed;
  const rng = createSeededRng(scrambleSeed(effectiveSeed) >>> 0);
  // Independent RNG for section/time arrangement so it never perturbs the
  // course-*selection* RNG sequence (keeps selection deterministic per seed),
  // while still varying the arrangement the new timetable enumerator returns.
  const arrangementRng = createSeededRng((scrambleSeed(effectiveSeed) ^ 0x9e3779b9) >>> 0);
  const timetablePipeline = buildTimetablePipeline(constraints);

  const immersionProgressOpts: FrenchImmersionProgressOptions | undefined = frenchImmersionStream
    ? { isNursingProgram: programTitleIndicatesNursing(programTitle) }
    : undefined;

  // Build effectiveRemainingRequirements: base + branch requirements from selected option branches
  const effectiveRemainingRequirements = buildEffectiveRemainingRequirements(
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
  );

  const { individualSelections: constrainedPerRequirement, groupTokenSelections } =
    expandConstrainedPerRequirement(constrainedPerRequirementRaw);

  const explicitExemptNormalized = new Set<string>();
  for (const codes of Object.values(constrainedPerRequirement)) {
    for (const code of codes) {
      if (!isGroupToken(code)) explicitExemptNormalized.add(normalizeCourseCode(code));
    }
  }
  for (const codes of Object.values(selectedPerRequirement)) {
    for (const code of codes) {
      if (!isGroupToken(code)) explicitExemptNormalized.add(normalizeCourseCode(code));
    }
  }

  const requirementTypeById = new Map<string, string | undefined>();
  for (const req of effectiveRemainingRequirements) {
    if (req.requirementId) requirementTypeById.set(req.requirementId, req.type);
  }

  const effectiveCache = cacheWithClosedFilter(cache, includeClosedComponents, false);

  const completedSet = new Set(completedCourses.map(normalizeCourseCode));
  const prereqEligibleSet = new Set(prereqEligibleCourses);
  const blacklistedSet = new Set(blacklistedCourses.map(normalizeCourseCode));
  const excludedElectivePrefixes = new Set(basicExcludedCategories.map((c) => c.toLowerCase()));

  /** True if `code`'s subject prefix is excluded AND the pool is a broad elective pool. */
  function isExcludedElectiveSubject(code: string, poolType: string | undefined): boolean {
    if (excludedElectivePrefixes.size === 0) return false;
    if (!isBroadElectivePoolType(poolType)) return false;
    const prefixMatch = code.match(/^([A-Z]{3,4})/i);
    const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
    return excludedElectivePrefixes.has(prefix);
  }

  const allConstrained = Object.values(constrainedPerRequirement).flat();
  const uniqueConstrained = [...new Set(allConstrained)];
  const honoursSelected: string[] = [];
  const seenHonours = new Set<string>();
  for (const code of uniqueConstrained) {
    if (!isHonoursProject(code, cache)) continue;
    const norm = normalizeCourseCode(code);
    if (completedSet.has(norm)) continue;
    if (!prereqEligibleSet.has(code)) continue;
    if (seenHonours.has(norm)) continue;
    seenHonours.add(norm);
    honoursSelected.push(code);
  }
  for (const codes of Object.values(selectedPerRequirement)) {
    for (const code of codes) {
      if (!isHonoursProject(code, cache)) continue;
      const norm = normalizeCourseCode(code);
      if (completedSet.has(norm)) continue;
      if (!prereqEligibleSet.has(code)) continue;
      if (seenHonours.has(norm)) continue;
      seenHonours.add(norm);
      honoursSelected.push(code);
    }
  }

  const implicitHonoursPicks = collectImplicitHonoursForSchedule(
    effectiveRemainingRequirements,
    selectedPerRequirement,
    completedSet,
    prereqEligibleSet,
    cache,
    includeClosedComponents,
    virtualSectionsOnly,
    explicitExemptNormalized,
    seenHonours,
  );
  const implicitHonoursRequirementId = new Map<string, string>();
  for (const { code, requirementId } of implicitHonoursPicks) {
    honoursSelected.push(code);
    implicitHonoursRequirementId.set(normalizeCourseCode(code), requirementId);
  }

  const honoursCount = honoursSelected.length;
  const effectiveTarget = Math.max(0, coursesThisSemester - honoursCount);

  const explicitUnion: string[] = [];
  const explicitSet = new Set<string>();
  for (const code of uniqueConstrained) {
    if (isHonoursProject(code, cache)) continue;
    if (
      !getEffectiveSchedule(cache, code, includeClosedComponents, false) ||
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
    effectiveTarget,
  );

  // Force-pin "courses you want" that matched no remaining requirement: scheduled
  // unconditionally, bypassing requirement membership and prerequisite eligibility, but still
  // validated against schedule availability and the active section/time constraints. Added to
  // explicitExemptNormalized so the virtual-only filter never strips their sections.
  const forcedPinned: string[] = [];
  const forcedSeen = new Set<string>();
  for (const code of forcedCourses) {
    const norm = normalizeCourseCode(code);
    if (forcedSeen.has(norm) || completedSet.has(norm)) continue;
    if (isHonoursProject(code, cache)) continue;
    const sched = getEffectiveSchedule(cache, code, includeClosedComponents, false);
    if (!sched) continue;
    if (getValidSectionCombos(sched, constraints).length === 0) continue;
    forcedSeen.add(norm);
    forcedPinned.push(code);
    explicitExemptNormalized.add(norm);
  }

  const pinned: string[] = [...honoursSelected];
  if (pinAllExplicit) {
    for (const code of explicitUnion) {
      if (!pinned.includes(code)) pinned.push(code);
    }
  }
  for (const code of forcedPinned) {
    if (!pinned.includes(code)) pinned.push(code);
  }

  function requirementIdForConstrainedCode(code: string): string | undefined {
    const norm = normalizeCourseCode(code);
    for (const [reqId, codes] of Object.entries(constrainedPerRequirement)) {
      if (codes.some((c) => normalizeCourseCode(c) === norm)) return reqId;
    }
    return undefined;
  }

  function requirementIdForPinnedCourse(code: string): string | undefined {
    const fromConstrain = requirementIdForConstrainedCode(code);
    if (fromConstrain != null) return fromConstrain;
    const norm = normalizeCourseCode(code);
    const implicitReq = implicitHonoursRequirementId.get(norm);
    if (implicitReq != null) return implicitReq;
    for (const [reqId, codes] of Object.entries(selectedPerRequirement)) {
      if (codes.some((c) => normalizeCourseCode(c) === norm)) return reqId;
    }
    return undefined;
  }

  const filters = { levels: levelBuckets, languageBuckets };

  const nonHonoursPinnedCount = pinned.filter((c) => !isHonoursProject(c, cache)).length;
  const remainingNeeded = Math.max(0, effectiveTarget - nonHonoursPinnedCount);
  let filteredOptionalPool: string[] = [];
  let foundSchedule: GeneratedSchedule | null = null;
  let poolDiagnostics: PoolDiagnostics | null = null;

  function isEligibleCandidate(code: string, poolType?: string): boolean {
    const virtualOnly = virtualScheduleFilterApplies(
      virtualSectionsOnly,
      poolType,
      code,
      explicitExemptNormalized,
    );
    const sched = getEffectiveSchedule(cache, code, includeClosedComponents, virtualOnly);
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
    if (isExcludedElectiveSubject(code, poolType)) return false;
    if (getValidSectionCombos(sched, constraints).length === 0) return false;
    if (blacklistedSet.has(normalizeCourseCode(code))) return false;
    return true;
  }

  if (remainingNeeded > 0) {
    const allPools = buildRequirementPools(effectiveRemainingRequirements);

    let pools: RequirementPool[] = allPools
      .map((pool) => {
        const constrainedForPool = constrainedPerRequirement[pool.requirementId] ?? [];
        const selectedForPool = selectedPerRequirement[pool.requirementId] ?? [];
        let pinnedCredits = 0;
        for (const code of pinned) {
          const primaryReqId = requirementIdForPinnedCourse(code);
          if (primaryReqId != null) {
            if (pool.requirementId !== primaryReqId) continue;
            const course = cache.getCourse(code);
            pinnedCredits += course?.credits ?? 3;
            continue;
          }
          if (!pool.candidateCourses.includes(code) && !constrainedForPool.includes(code)) {
            continue;
          }
          const course = cache.getCourse(code);
          pinnedCredits += course?.credits ?? 3;
        }
        let completedSelectedCredits = 0;
        for (const code of selectedForPool) {
          if (!completedSet.has(normalizeCourseCode(code))) continue;
          const course = cache.getCourse(code);
          completedSelectedCredits += course?.credits ?? 3;
        }
        const remainingCredits = Math.max(
          0,
          pool.creditsNeeded - pinnedCredits - completedSelectedCredits,
        );
        return { ...pool, creditsNeeded: remainingCredits };
      })
      .filter((pool) => pool.creditsNeeded > 0);

    pools = pools.filter((pool) => {
      if (pool.type !== "course" && pool.type !== "or_course") return true;
      return pool.candidateCourses.some((code) => {
        if (isHonoursProject(code, cache)) return false;
        return !!getEffectiveSchedule(
          cache,
          code,
          includeClosedComponents,
          virtualScheduleFilterApplies(
            virtualSectionsOnly,
            pool.type,
            code,
            explicitExemptNormalized,
          ),
        );
      });
    });

    const candidatesByRequirement = new Map<string, string[]>();
    for (const pool of pools) {
      const candidates: string[] = [];
      for (const code of pool.candidateCourses) {
        const sched = getEffectiveSchedule(
          cache,
          code,
          includeClosedComponents,
          virtualScheduleFilterApplies(
            virtualSectionsOnly,
            pool.type,
            code,
            explicitExemptNormalized,
          ),
        );
        if (
          !sched ||
          pinned.includes(code) ||
          completedCourses.includes(code) ||
          !prereqEligibleSet.has(code) ||
          !courseMatchesFilters(code, filters)
        ) {
          continue;
        }
        if (isElectiveRequirementType(pool.type) && !isWithinElectiveLevelCap(code)) continue;
        if (isExcludedElectiveSubject(code, pool.type)) continue;
        if (electiveLevelBuckets.length > 0 && isBroadElectivePoolType(pool.type)) {
          const match = code.match(/\d{4}/);
          if (match) {
            const num = Number.parseInt(match[0], 10);
            if (!Number.isNaN(num)) {
              const bucket = Math.floor(num / 1000) * 1000;
              if (!electiveLevelBuckets.includes(bucket)) continue;
            }
          }
        }
        if (isHonoursProject(code, cache)) continue;
        if (blacklistedSet.has(normalizeCourseCode(code))) continue;
        if (getValidSectionCombos(sched, constraints).length === 0) continue;
        candidates.push(code);
      }
      if (candidates.length > 0) candidatesByRequirement.set(pool.requirementId, candidates);
    }

    const poolsWithNoEligibleCandidates = pools.filter(
      (p) => !candidatesByRequirement.has(p.requirementId),
    );
    pools = pools.filter((p) => candidatesByRequirement.has(p.requirementId));

    const coursesPerPool = computeCoursesPerPool(pools, remainingNeeded, cache);
    const poolCaps = buildPoolCaps(pools);
    const redistributionAlts = enumerateSingleRedistributions(coursesPerPool, pools, poolCaps);

    const highLevelPoolIds = new Set<string>();
    for (const pool of pools) {
      if (isBroadElectivePoolType(pool.type)) continue;
      const candidates = candidatesByRequirement.get(pool.requirementId) ?? [];
      if (candidates.length > 0 && candidates.every((c) => courseLevelSortKey(c) >= 2000)) {
        highLevelPoolIds.add(pool.requirementId);
      }
    }
    const highLevelRedistAlts = redistributionAlts.filter((alt) =>
      [...alt.entries()].some(
        ([id, count]) => highLevelPoolIds.has(id) && count < (coursesPerPool.get(id) ?? 0),
      ),
    );

    const seenCourseSets = new Set<string>();
    let chosenFromPool: Record<string, string> = {};

    type PoolPickPassResult = { ok: true; chosenFromPool: Record<string, string> } | { ok: false };

    function poolPickFailure(): PoolPickPassResult {
      return { ok: false };
    }

    const easierMemo = new Map<string, number>();
    function immersionCodesWithChosen(chosen: Set<string>): string[] {
      const s = new Set(completedCourses.map((c) => normalizeCourseCode(c)));
      for (const c of chosen) s.add(normalizeCourseCode(c));
      return [...s];
    }
    function easierMultiplierForCourse(code: string): number {
      if (!generationPreferEasier) return 1;
      let m = easierMemo.get(code);
      if (m !== undefined) return m;
      const aPlus = courseDifficultyIndex ? courseDifficultyIndex(code) : null;
      m =
        aPlus == null
          ? 1
          : Math.pow(EASIER_APLUS_BASE, (aPlus - EASIER_APLUS_PIVOT) / EASIER_APLUS_SCALE);
      easierMemo.set(code, m);
      return m;
    }

    function runPoolPickPass(perPoolNeed: Map<string, number>): PoolPickPassResult {
      const chosenCodes = new Set<string>(pinned);
      const localChosenFromPool: Record<string, string> = {};
      for (const code of pinned) {
        if (isHonoursProject(code, cache)) continue;
        const reqId = requirementIdForPinnedCourse(code);
        if (reqId) localChosenFromPool[code] = reqId;
      }

      const remaining = new Map<string, number>();
      for (const pool of pools) {
        const n = perPoolNeed.get(pool.requirementId) ?? 0;
        if (n > 0) remaining.set(pool.requirementId, n);
      }

      const pendingGroupPicks = clonePendingGroupPickCounts(
        buildPendingGroupPickCounts(groupTokenSelections),
      );
      for (const code of pinned) {
        if (isHonoursProject(code, cache)) continue;
        const rid = requirementIdForPinnedCourse(code);
        if (!rid) continue;
        const agg = pendingGroupPicks.get(rid);
        if (!agg?.size) continue;
        const pfx = subjectPrefix(code);
        const cur = agg.get(pfx) ?? 0;
        if (cur > 0) agg.set(pfx, cur - 1);
      }

      const totalRemaining = (): number => [...remaining.values()].reduce((a, b) => a + b, 0);

      // Pre-flight: verify each pool has enough eligible candidates
      for (const pool of pools) {
        const r = remaining.get(pool.requirementId) ?? 0;
        if (r <= 0) continue;

        const constrainedForPool = constrainedPerRequirement[pool.requirementId] ?? [];
        const S = constrainedForPool.filter((code) => isEligibleCandidate(code, pool.type));
        const sSet = new Set(S);
        const candidates = candidatesByRequirement.get(pool.requirementId) ?? [];
        const G = candidates.filter((code) => !sSet.has(code));
        const SAvail = S.filter((code) => !chosenCodes.has(code));
        let GAvail = G.filter((code) => !chosenCodes.has(code));
        if (explicitOnly) GAvail = GAvail.filter((code) => explicitSet.has(code));

        const needS = Math.min(r, SAvail.length);
        const needG = r - needS;
        if (needG > GAvail.length) return poolPickFailure();

        const pend = pendingGroupPicks.get(pool.requirementId);
        if (pend?.size) {
          let forcedInPool = 0;
          for (const [pfx, rem] of pend.entries()) {
            if (rem <= 0) continue;
            if (!pool.candidateCourses.some((c) => subjectPrefix(c) === pfx)) continue;
            forcedInPool += rem;
          }
          if (forcedInPool > r) return poolPickFailure();
          const orderedPrefixes = [...pend.entries()].sort(([a], [b]) => a.localeCompare(b));
          for (const [pfx, rem] of orderedPrefixes) {
            if (rem <= 0) continue;
            if (!pool.candidateCourses.some((c) => subjectPrefix(c) === pfx)) continue;
            const nPrefixAvail = candidates.filter(
              (c) =>
                subjectPrefix(c) === pfx &&
                !chosenCodes.has(c) &&
                isEligibleCandidate(c, pool.type),
            ).length;
            if (nPrefixAvail < rem) return poolPickFailure();
          }
        }
      }

      type WeightedCand = { pool: RequirementPool; code: string; weight: number };

      while (totalRemaining() > 0) {
        const immersionProgForPick =
          frenchImmersionStream && immersionProgressOpts != null
            ? analyzeFrenchImmersionProgress(
                immersionCodesWithChosen(chosenCodes),
                cache,
                immersionProgressOpts,
              )
            : null;

        const cands: WeightedCand[] = [];

        for (const pool of pools) {
          const r = remaining.get(pool.requirementId) ?? 0;
          if (r <= 0) continue;

          const constrainedForPool = constrainedPerRequirement[pool.requirementId] ?? [];
          const S = constrainedForPool.filter((code) => isEligibleCandidate(code, pool.type));
          const sSet = new Set(S);
          const candidates = candidatesByRequirement.get(pool.requirementId) ?? [];
          const G = candidates.filter((code) => !sSet.has(code));
          const SAvail = S.filter((code) => !chosenCodes.has(code));
          let GAvail = G.filter((code) => !chosenCodes.has(code));
          if (explicitOnly) GAvail = GAvail.filter((code) => explicitSet.has(code));

          const needS = Math.min(r, SAvail.length);
          const needG = r - needS;
          if (needG > GAvail.length) return poolPickFailure();

          let forcedPrefix: string | undefined;
          const pendLoop = pendingGroupPicks.get(pool.requirementId);
          if (pendLoop?.size) {
            const ordered = [...pendLoop.entries()]
              .filter(([, rem]) => rem > 0)
              .sort(([a], [b]) => a.localeCompare(b));
            for (const [pfx] of ordered) {
              if (!pool.candidateCourses.some((c) => subjectPrefix(c) === pfx)) continue;
              const hasAvail = candidates.some(
                (c) =>
                  subjectPrefix(c) === pfx &&
                  !chosenCodes.has(c) &&
                  isEligibleCandidate(c, pool.type),
              );
              if (hasAvail) {
                forcedPrefix = pfx;
                break;
              }
            }
          }

          let list: string[];
          if (forcedPrefix != null) {
            list = candidates.filter(
              (c) =>
                subjectPrefix(c) === forcedPrefix &&
                !chosenCodes.has(c) &&
                isEligibleCandidate(c, pool.type),
            );
            if (list.length === 0) return poolPickFailure();
          } else {
            const pickFromS = needS > 0;
            list = pickFromS ? SAvail : GAvail;
            if (list.length === 0) continue;
          }

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
            let immersionW = 1;
            if (immersionProgForPick != null) {
              immersionW = frenchImmersionHeuristicPickWeight(immersionProgForPick, code, cache);
            }
            cands.push({
              pool,
              code,
              weight:
                (candidatePoolWeight(level, hasNonCoursePrereq) / bucketSize) *
                easierMultiplierForCourse(code) *
                immersionW,
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
        localChosenFromPool[picked.code] = picked.pool.requirementId;
        const prev = remaining.get(picked.pool.requirementId) ?? 0;
        remaining.set(picked.pool.requirementId, prev - 1);

        const pendAfter = pendingGroupPicks.get(picked.pool.requirementId);
        if (pendAfter?.size) {
          const pfx = subjectPrefix(picked.code);
          const cur = pendAfter.get(pfx) ?? 0;
          if (cur > 0) pendAfter.set(pfx, cur - 1);
        }
      }

      if (totalRemaining() > 0) return poolPickFailure();
      return { ok: true, chosenFromPool: localChosenFromPool };
    }

    let lastFilteredPool: string[] = [];

    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      if (foundSchedule) break;

      for (const list of candidatesByRequirement.values()) {
        if (!frenchImmersionStream) shuffleInPlace(list, rng);
      }

      const allocationPool =
        highLevelRedistAlts.length > 0
          ? [coursesPerPool, ...highLevelRedistAlts]
          : [coursesPerPool];
      const firstAlloc = allocationPool[Math.floor(rng() * allocationPool.length)];

      let pickPass: PoolPickPassResult = runPoolPickPass(firstAlloc);
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

      chosenFromPool = pickPass.chosenFromPool;
      const chosenCodes = new Set<string>(pinned);
      for (const code of Object.keys(chosenFromPool)) chosenCodes.add(code);

      const optionalPool = Array.from(chosenCodes).filter((code) => !pinned.includes(code));
      const slotsFromOptional = coursesThisSemester - pinned.length;
      if (optionalPool.length < slotsFromOptional) {
        if (optionalPool.length > lastFilteredPool.length) lastFilteredPool = optionalPool;
        continue;
      }

      lastFilteredPool = optionalPool;
      reorderOptionalPoolForGeneration(lastFilteredPool, cache, rng, {
        preferEasier: false,
        frenchImmersionStream,
        immersionOpts: immersionProgressOpts,
        immersionProgressBaseCodes: [...completedCourses, ...pinned],
      });

      const attemptCache = cacheWithPerCourseVirtualFilter(
        cache,
        includeClosedComponents,
        (code) => {
          const reqId = chosenFromPool[code] ?? requirementIdForPinnedCourse(code);
          const reqType = reqId ? requirementTypeById.get(reqId) : undefined;
          return virtualScheduleFilterApplies(
            virtualSectionsOnly,
            reqType,
            code,
            explicitExemptNormalized,
          );
        },
      );

      // The selector guarantees |pinned ∪ optionalPool| == coursesThisSemester,
      // so the course set is fixed: the new enumerator arranges its sections in
      // a seeded order and returns the first conflict-free arrangement (the old
      // solver always returned the first cartesian arrangement — bug #1).
      const arranged = firstSeededArrangement(
        [...pinned, ...lastFilteredPool],
        attemptCache,
        timetablePipeline,
        arrangementRng,
      );

      if (arranged) {
        const fingerprint = arranged.enrollments
          .map((e) => e.courseCode)
          .sort()
          .join(",");
        if (!seenCourseSets.has(fingerprint)) {
          seenCourseSets.add(fingerprint);
          foundSchedule = arranged;
        }
      }
    }

    filteredOptionalPool = lastFilteredPool;

    poolDiagnostics = {
      emptyPools: poolsWithNoEligibleCandidates.map((p) => ({
        label: p.label,
        requirementId: p.requirementId,
        candidateCourses: p.candidateCourses,
      })),
      totalAvailable: pinned.length + filteredOptionalPool.length,
      totalNeeded: coursesThisSemester,
    };
  }

  if (remainingNeeded <= 0) {
    filteredOptionalPool = [];
    // remainingNeeded <= 0 means pinned already fills (or over-fills) every slot. All pinned
    // courses — including force-pinned "courses you want" and constrained picks that exceed
    // coursesThisSemester — are scheduled together: the target is effectively clamped up to the
    // pinned count so a desired/forced course is never silently dropped.
    const arranged = firstSeededArrangement(
      pinned,
      effectiveCache,
      timetablePipeline,
      arrangementRng,
    );
    if (arranged) foundSchedule = arranged;
  }

  return { schedule: foundSchedule, filteredOptionalPool, pinned, poolDiagnostics };
}
