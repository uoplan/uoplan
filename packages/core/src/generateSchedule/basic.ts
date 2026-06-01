import type {
  CourseDifficultyIndex,
  CourseLanguageBucket,
  CourseLevelBucket,
  DataCache,
  FrenchImmersionProgressOptions,
  GeneratedSchedule,
  GenerationConstraints,
} from "../index";
import {
  buildPrereqContext,
  cacheWithClosedFilter,
  cacheWithPerCourseVirtualFilter,
  canTakeCourse,
  courseMatchesFilters,
  createSeededRng,
  getValidSectionCombos,
  isWithinElectiveLevelBuckets,
  normalizeCourseCode,
  programTitleIndicatesNursing,
} from "../index";
import { buildTimetablePipeline, firstSeededSubsetArrangement } from "../engine/integration";
import { scrambleSeed } from "./helpers";
import { reorderOptionalPoolForGeneration } from "./reorderOptionalPool";

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
