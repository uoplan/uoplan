import type { DataCache } from "./dataCache";
import { getCourseLanguageBucket } from "./courseFilters";
import {
  getCourseCredits,
  getCourseLevel,
  normalizeCourseCode,
  parseCourseCode,
} from "./utils/courseUtils";

/** Second Language Certification — excluded from course/unit tallies; tracked separately in UI. */
export const FLS_IMMERSION_CERT_CODE = "FLS 3500";

const ACCOMPANYING_FLS_NUMBERS = new Set([2581, 3581, 4581, 4781]);

export interface FrenchImmersionProgressOptions {
  /** Nursing stream: 12 courses / 36 units instead of 14 / 42. */
  isNursingProgram?: boolean;
}

export interface FrenchImmersionProgress {
  requiredCourses: number;
  requiredUnits: number;
  isNursingProgram: boolean;
  /** Course codes that count toward the volume requirement after companion caps. */
  countedTowardVolumeCodes: string[];
  countedCourses: number;
  countedUnits: number;
  level1000NonFls: {
    courses: number;
    units: number;
    requiredCourses: number;
    requiredUnits: number;
  };
  level3000Or4000NonFls: {
    courses: number;
    units: number;
    requiredCourses: number;
    requiredUnits: number;
  };
  accompanyingFls: {
    countedCourses: number;
    countedUnits: number;
    maxTotalCourses: number;
    maxTotalUnits: number;
    counted2581Courses: number;
    max2581Courses: number;
  };
  volumeMet: boolean;
  min1000NonFlsMet: boolean;
  min3000Or4000NonFlsMet: boolean;
  /** False when some accompanying FLS courses exceed caps and do not count toward volume. */
  allAccompanyingFlsCountTowardVolume: boolean;
  /** Companion courses not counted toward the 14/12 because of caps. */
  excludedCompanionCodes: string[];
}

function primaryCourseNumber(code: string): number | null {
  const p = parseCourseCode(normalizeCourseCode(code));
  if (!p) return null;
  const m = p.number.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Official rule: 5th digit of the numeric part is 0 or 9 → does not count. */
export function frenchImmersionExcludedByFifthDigit(code: string): boolean {
  const p = parseCourseCode(normalizeCourseCode(code));
  if (!p) return false;
  const digits = p.number.replace(/[^0-9]/g, "");
  if (digits.length < 5) return false;
  const d = digits[4];
  return d === "0" || d === "9";
}

export function isAccompanyingFlsCourse(code: string): boolean {
  const p = parseCourseCode(normalizeCourseCode(code));
  if (!p || p.discipline !== "FLS") return false;
  const n = primaryCourseNumber(code);
  return n != null && ACCOMPANYING_FLS_NUMBERS.has(n);
}

export function isFls2581Companion(code: string): boolean {
  return primaryCourseNumber(code) === 2581;
}

export function programTitleIndicatesNursing(title: string | null | undefined): boolean {
  if (!title?.trim()) return false;
  return /\bnursing\b/i.test(title);
}

/**
 * Whether a course can count toward French Immersion diploma progress (before companion caps).
 * Excludes FLS 3500 entirely. Does not apply companion caps — use {@link analyzeFrenchImmersionProgress}.
 */
export function countsTowardFrenchImmersionBeforeCompanionCaps(code: string): boolean {
  const norm = normalizeCourseCode(code);
  if (norm === FLS_IMMERSION_CERT_CODE) return false;
  if (getCourseLanguageBucket(norm) !== "fr") return false;
  if (frenchImmersionExcludedByFifthDigit(norm)) return false;

  const p = parseCourseCode(norm);
  if (!p) return false;
  if (p.discipline === "FLS") {
    const n = primaryCourseNumber(norm);
    if (n == null || n < 2513) return false;
  }
  return true;
}

function unitsFor(code: string, cache: DataCache | null): number {
  return getCourseCredits(code, cache);
}

function selectCompanionSubset(companionCodes: string[]): {
  counted: string[];
  excluded: string[];
} {
  const c2581 = companionCodes.filter((c) => isFls2581Companion(c));
  const cOther = companionCodes.filter((c) => !isFls2581Companion(c));
  const take2581 = Math.min(c2581.length, 2);
  const takeOther = Math.min(cOther.length, Math.max(0, 4 - take2581));
  const counted = [...c2581.slice(0, take2581), ...cOther.slice(0, takeOther)];
  const temp = [...companionCodes];
  for (const c of counted) {
    const idx = temp.indexOf(c);
    if (idx >= 0) temp.splice(idx, 1);
  }
  return { counted, excluded: temp };
}

/**
 * Indicative progress toward French Immersion designation rules from a set of course codes
 * (e.g. completed + current timetable). Not an official audit.
 */
export function analyzeFrenchImmersionProgress(
  courseCodes: string[],
  cache: DataCache | null,
  options: FrenchImmersionProgressOptions = {},
): FrenchImmersionProgress {
  const isNursing = options.isNursingProgram === true;
  const requiredCourses = isNursing ? 12 : 14;
  const requiredUnits = isNursing ? 36 : 42;

  const normalized = courseCodes.map((c) => normalizeCourseCode(c));
  const companionInstances: string[] = [];
  const nonCompanionCodes: string[] = [];
  const seenNonCompanion = new Set<string>();

  for (const c of normalized) {
    if (!countsTowardFrenchImmersionBeforeCompanionCaps(c)) continue;
    if (isAccompanyingFlsCourse(c)) {
      companionInstances.push(c);
    } else if (!seenNonCompanion.has(c)) {
      seenNonCompanion.add(c);
      nonCompanionCodes.push(c);
    }
  }

  const { counted: companionCounted, excluded: excludedCompanionCodes } =
    selectCompanionSubset(companionInstances);

  const countedTowardVolumeCodes = [...nonCompanionCodes, ...companionCounted].sort();
  let countedUnits = 0;
  for (const c of countedTowardVolumeCodes) {
    countedUnits += unitsFor(c, cache);
  }

  const level1000: string[] = [];
  const level3000Or4000: string[] = [];
  for (const c of countedTowardVolumeCodes) {
    const p = parseCourseCode(c);
    if (!p || p.discipline === "FLS") continue;
    const lvl = getCourseLevel(c);
    if (lvl === 1000) level1000.push(c);
    if (lvl === 3000 || lvl === 4000) level3000Or4000.push(c);
  }

  let u1000 = 0;
  for (const c of level1000) u1000 += unitsFor(c, cache);
  let u3000 = 0;
  for (const c of level3000Or4000) u3000 += unitsFor(c, cache);

  let accUnits = 0;
  for (const c of companionCounted) accUnits += unitsFor(c, cache);

  const counted2581Courses = companionCounted.filter((c) => isFls2581Companion(c)).length;

  const volumeMet =
    countedTowardVolumeCodes.length >= requiredCourses && countedUnits >= requiredUnits;
  const min1000NonFlsMet = level1000.length >= 2 && u1000 >= 6;
  const min3000Or4000NonFlsMet = level3000Or4000.length >= 2 && u3000 >= 6;
  const allAccompanyingFlsCountTowardVolume = excludedCompanionCodes.length === 0;

  return {
    requiredCourses,
    requiredUnits,
    isNursingProgram: isNursing,
    countedTowardVolumeCodes,
    countedCourses: countedTowardVolumeCodes.length,
    countedUnits,
    level1000NonFls: {
      courses: level1000.length,
      units: u1000,
      requiredCourses: 2,
      requiredUnits: 6,
    },
    level3000Or4000NonFls: {
      courses: level3000Or4000.length,
      units: u3000,
      requiredCourses: 2,
      requiredUnits: 6,
    },
    accompanyingFls: {
      countedCourses: companionCounted.length,
      countedUnits: accUnits,
      maxTotalCourses: 4,
      maxTotalUnits: 12,
      counted2581Courses,
      max2581Courses: 2,
    },
    volumeMet,
    min1000NonFlsMet,
    min3000Or4000NonFlsMet,
    allAccompanyingFlsCountTowardVolume,
    excludedCompanionCodes,
  };
}

export function completedCoursesIncludeFls3500(completedCodes: string[]): boolean {
  return completedCodes.some((c) => normalizeCourseCode(c) === FLS_IMMERSION_CERT_CODE);
}

/** Category for displaying which counting courses satisfy which designation buckets. */
export type FrenchImmersionDisplayCategory =
  | "accompanying_fls"
  | "level_1000_non_fls"
  | "level_3000_4000_non_fls"
  | "other_french";

/** Groups courses that count toward immersion volume (post cap) for read-only UI. */
export function groupCountedFrenchImmersionCodesByCategory(
  countedTowardVolumeCodes: readonly string[],
): Record<FrenchImmersionDisplayCategory, string[]> {
  const buckets: Record<FrenchImmersionDisplayCategory, string[]> = {
    accompanying_fls: [],
    level_1000_non_fls: [],
    level_3000_4000_non_fls: [],
    other_french: [],
  };
  for (const code of countedTowardVolumeCodes) {
    const p = parseCourseCode(code);
    if (isAccompanyingFlsCourse(code)) {
      buckets.accompanying_fls.push(code);
    } else if (p && p.discipline !== "FLS") {
      const lvl = getCourseLevel(code);
      if (lvl === 1000) buckets.level_1000_non_fls.push(code);
      else if (lvl === 3000 || lvl === 4000) buckets.level_3000_4000_non_fls.push(code);
      else buckets.other_french.push(code);
    } else {
      buckets.other_french.push(code);
    }
  }
  return buckets;
}

/** Single overall progress toward designation volume: bottleneck of course vs unit fill (0–100). */
export function frenchImmersionOverallVolumePercent(p: FrenchImmersionProgress): number {
  const cPct = p.requiredCourses > 0 ? (100 * p.countedCourses) / p.requiredCourses : 0;
  const uPct = p.requiredUnits > 0 ? (100 * p.countedUnits) / p.requiredUnits : 0;
  return Math.min(100, Math.round(Math.min(cPct, uPct)));
}

/**
 * Single scalar in [0, 1]: average of normalized progress toward volume, 1000/3000 non-FLS
 * minima, and accompanying-FLS cap health. Used to bias schedule generation toward the
 * designation “evenly” across those dimensions.
 */
export function frenchImmersionBalancedObjective(p: FrenchImmersionProgress): number {
  const vol = Math.min(
    1,
    p.requiredCourses > 0 && p.requiredUnits > 0
      ? Math.min(p.countedCourses / p.requiredCourses, p.countedUnits / p.requiredUnits)
      : 0,
  );
  const l1000 = Math.min(
    1,
    Math.min(
      p.level1000NonFls.courses / p.level1000NonFls.requiredCourses,
      p.level1000NonFls.units / p.level1000NonFls.requiredUnits,
    ),
  );
  const l34 = Math.min(
    1,
    Math.min(
      p.level3000Or4000NonFls.courses / p.level3000Or4000NonFls.requiredCourses,
      p.level3000Or4000NonFls.units / p.level3000Or4000NonFls.requiredUnits,
    ),
  );
  const acc = p.allAccompanyingFlsCountTowardVolume
    ? 1
    : Math.min(
        1,
        0.12 +
          0.88 *
            Math.min(
              p.accompanyingFls.maxTotalCourses > 0
                ? p.accompanyingFls.countedCourses / p.accompanyingFls.maxTotalCourses
                : 1,
              p.accompanyingFls.maxTotalUnits > 0
                ? p.accompanyingFls.countedUnits / p.accompanyingFls.maxTotalUnits
                : 1,
            ),
      );
  return (vol + l1000 + l34 + acc) / 4;
}

/**
 * O(1) weight multiplier for schedule generation from a single {@link analyzeFrenchImmersionProgress}
 * snapshot. Favors courses that count toward immersion and match obvious gaps (volume, 1000/3000 non-FLS).
 * Intentionally avoids per-candidate marginal {@link analyzeFrenchImmersionProgress} calls (too slow on large pools).
 */
export function frenchImmersionHeuristicPickWeight(
  p: FrenchImmersionProgress,
  code: string,
  _cache: DataCache | null,
): number {
  if (!countsTowardFrenchImmersionBeforeCompanionCaps(code)) return 1;
  const norm = normalizeCourseCode(code);
  const parsed = parseCourseCode(norm);
  const disc = parsed?.discipline;

  let w = 1;
  if (!p.volumeMet) {
    w += 0.42;
  }

  if (disc && disc !== "FLS") {
    const lvl = getCourseLevel(norm);
    if (lvl === 1000 && !p.min1000NonFlsMet) w += 0.22;
    if ((lvl === 3000 || lvl === 4000) && !p.min3000Or4000NonFlsMet) w += 0.22;
  }

  if (isAccompanyingFlsCourse(norm)) {
    w += p.allAccompanyingFlsCountTowardVolume ? 0.06 : 0.1;
  } else if (disc === "FLS") {
    w += 0.06;
  }

  return Math.min(2.35, w);
}

/** Change in {@link frenchImmersionBalancedObjective} when adding one course code to the base set. */
export function frenchImmersionMarginalObjectiveDelta(
  baseCodes: readonly string[],
  candidateCode: string,
  cache: DataCache | null,
  opts?: FrenchImmersionProgressOptions,
): number {
  const merged = baseCodes.map((c) => normalizeCourseCode(c));
  const norm = normalizeCourseCode(candidateCode);
  const before = analyzeFrenchImmersionProgress(merged, cache, opts);
  const after = analyzeFrenchImmersionProgress([...merged, norm], cache, opts);
  return frenchImmersionBalancedObjective(after) - frenchImmersionBalancedObjective(before);
}
