import type { DataCache } from "./dataCache";
import { getCourseLevel, normalizeCourseCode } from "./utils/courseUtils";
import type { RemainingRequirement } from "./requirements";

export type RequirementPool = {
  requirementId: string;
  type: RemainingRequirement["type"];
  label: string;
  candidateCourses: string[];
  creditsNeeded: number;
  minCourses: number;
};

export function buildRequirementPools(remaining: RemainingRequirement[]): RequirementPool[] {
  const pools: RequirementPool[] = [];

  for (const req of remaining) {
    if (!req.requirementId || !req.candidateCourses?.length) continue;
    const creditsNeeded = req.creditsNeeded ?? 0;
    if (creditsNeeded <= 0) continue;

    const uniqueCandidates = [...new Set(req.candidateCourses)];
    if (uniqueCandidates.length === 0) continue;

    const label = req.title ?? req.type ?? "Requirement";
    let minCourses = 0;
    if (req.type === "course" || req.type === "or_course") {
      minCourses = 1;
    }

    pools.push({
      requirementId: req.requirementId,
      type: req.type,
      label,
      candidateCourses: uniqueCandidates,
      creditsNeeded,
      minCourses,
    });
  }

  return pools;
}

const DEFAULT_CREDITS_PER_COURSE = 3;

export function isBroadElectivePoolType(type?: string): boolean {
  return (
    type === "elective" ||
    type === "free_elective" ||
    type === "non_discipline_elective" ||
    type === "faculty_elective"
  );
}

export function isElectiveRequirementType(type: string | undefined): boolean {
  return (
    type === "discipline_elective" ||
    type === "elective" ||
    type === "faculty_elective" ||
    type === "free_elective" ||
    type === "non_discipline_elective"
  );
}

const MAX_ELECTIVE_LEVEL = 4000;

export function isWithinElectiveLevelCap(code: string): boolean {
  const level = getCourseLevel(code);
  return level == null || level <= MAX_ELECTIVE_LEVEL;
}

export function isWithinElectiveLevelBuckets(
  code: string,
  electiveLevelBuckets: number[],
): boolean {
  if (electiveLevelBuckets.length === 0) return isWithinElectiveLevelCap(code);
  const level = getCourseLevel(code);
  if (level == null) return true;
  const bucket = Math.floor(level / 1000) * 1000;
  return electiveLevelBuckets.includes(bucket);
}

export function virtualScheduleFilterApplies(
  virtualSectionsOnly: boolean,
  requirementType: string | undefined,
  courseCode: string,
  explicitExemptNormalized: Set<string>,
): boolean {
  if (!virtualSectionsOnly) return false;
  if (!isBroadElectivePoolType(requirementType)) return false;
  const norm = normalizeCourseCode(courseCode);
  if (explicitExemptNormalized.has(norm)) return false;
  return true;
}

export function poolCourseCap(pool: RequirementPool): number {
  const raw = Math.max(pool.minCourses, Math.ceil(pool.creditsNeeded / DEFAULT_CREDITS_PER_COURSE));
  if (pool.type === "discipline_elective") {
    return Math.min(raw, 1);
  }
  return raw;
}

export function buildPoolCaps(pools: RequirementPool[]): Map<string, number> {
  const cap = new Map<string, number>();
  for (const pool of pools) {
    cap.set(pool.requirementId, poolCourseCap(pool));
  }
  return cap;
}

export function enumerateSingleRedistributions(
  coursesPerPool: Map<string, number>,
  pools: RequirementPool[],
  cap: Map<string, number>,
): Map<string, number>[] {
  const structured = pools.filter((p) => !isBroadElectivePoolType(p.type));
  const broad = pools.filter((p) => isBroadElectivePoolType(p.type));
  const out: Map<string, number>[] = [];
  const seen = new Set<string>();

  for (const s of structured) {
    const sn = coursesPerPool.get(s.requirementId) ?? 0;
    if (sn <= 0) continue;
    for (const b of broad) {
      const bn = coursesPerPool.get(b.requirementId) ?? 0;
      const bc = cap.get(b.requirementId) ?? 0;
      if (bn >= bc) continue;
      const m = new Map(coursesPerPool);
      m.set(s.requirementId, sn - 1);
      m.set(b.requirementId, bn + 1);
      const key = [...m.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, n]) => `${id}:${n}`)
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

function greedyPlaceOne(
  poolSubset: RequirementPool[],
  result: Map<string, number>,
  cap: Map<string, number>,
): boolean {
  const next = poolSubset
    .map((p) => {
      const cur = result.get(p.requirementId) ?? 0;
      const maxC = cap.get(p.requirementId) ?? 0;
      return { pool: p, cur, maxC, room: maxC - cur };
    })
    .filter((x) => x.room > 0)
    .sort((a, b) => {
      if (b.room !== a.room) return b.room - a.room;
      return b.pool.creditsNeeded - a.pool.creditsNeeded;
    })[0];
  if (!next) return false;
  result.set(next.pool.requirementId, next.cur + 1);
  return true;
}

export function computeCoursesPerPool(
  pools: RequirementPool[],
  remainingCourseSlots: number,
  _cache: DataCache,
): Map<string, number> {
  const result = new Map<string, number>();
  if (remainingCourseSlots <= 0 || pools.length === 0) return result;

  const cap = new Map<string, number>();
  let sumCap = 0;
  for (const pool of pools) {
    const c = poolCourseCap(pool);
    cap.set(pool.requirementId, c);
    sumCap += c;
    result.set(pool.requirementId, 0);
  }

  if (sumCap === 0) return new Map();

  const target = Math.min(remainingCourseSlots, sumCap);
  const structuredPools = pools.filter((p) => !isBroadElectivePoolType(p.type));
  const broadPools = pools.filter((p) => isBroadElectivePoolType(p.type));

  let placed = 0;
  const sumCapStructured = structuredPools.reduce((s, p) => s + (cap.get(p.requirementId) ?? 0), 0);
  const targetStructured = Math.min(target, sumCapStructured);
  while (placed < targetStructured) {
    if (!greedyPlaceOne(structuredPools, result, cap)) break;
    placed += 1;
  }

  while (placed < target) {
    if (!greedyPlaceOne(broadPools, result, cap)) break;
    placed += 1;
  }

  if (placed < remainingCourseSlots && broadPools.length > 0 && structuredPools.length > 0) {
    const overflowCap = new Map(cap);
    for (const p of broadPools) {
      overflowCap.set(p.requirementId, remainingCourseSlots);
    }
    while (placed < remainingCourseSlots) {
      if (!greedyPlaceOne(broadPools, result, overflowCap)) break;
      placed += 1;
    }
  }

  return result;
}

export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

export function weightedRandomPick<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Each level tier is this many times less likely than the one below it. */
export const LEVEL_WEIGHT_BASE = 2;
const NON_COURSE_PREREQ_PENALTY = 0.3;
const UNKNOWN_LEVEL_FLOOR = 0.01;
const UNKNOWN_COURSE_LEVEL = 999_000;

export function courseLevelSortKey(code: string): number {
  return getCourseLevel(code) ?? UNKNOWN_COURSE_LEVEL;
}

export function candidatePoolWeight(level: number, hasNonCoursePrereq: boolean): number {
  if (level >= UNKNOWN_COURSE_LEVEL) return UNKNOWN_LEVEL_FLOOR;
  const tier = Math.max(1, Math.floor(level / 1000));
  let w = 1 / Math.pow(LEVEL_WEIGHT_BASE, tier - 1);
  if (hasNonCoursePrereq) w *= NON_COURSE_PREREQ_PENALTY;
  return w;
}
