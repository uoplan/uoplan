import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import {
  encodeStateToBase64,
  isOptCourse,
  makeGroupTokenInstance,
  normalizeCourseCode,
  requirementIdsFromTree,
  urlToSlug,
  withExtraCourses,
} from "@uoplan/core";
import type { Course, DecodedState, EncodeInput, Program } from "@uoplan/core";
import { recomputeStateForProgram } from "../requirementCompute";
import { inferLowestVisitedSeedFromPersisted } from "../seedNavigation";
import { toBlockedWindows, withBlockedIds } from "../blockedTimes";
import type { AppServices } from "../services";

interface UrlSlice {
  loadEncodedState: AppStore["loadEncodedState"];
  getEncodedStateBase64: AppStore["getEncodedStateBase64"];
  getShareUrl: AppStore["getShareUrl"];
}

function buildEncodeInput(s: AppStore): EncodeInput {
  const completedCourses = s.completedCourses.map((code) =>
    s.cache ? s.cache.resolveToCanonical(code) : code,
  );
  return {
    selectedTermId: s.selectedTermId,
    firstYear: s.firstYear,
    program: s.program,
    minorProgram: s.minorProgram,
    completedCourses,
    levelBuckets: s.levelBuckets,
    languageBuckets: s.languageBuckets,
    electiveLevelBuckets: s.electiveLevelBuckets,
    coursesThisSemester: s.coursesThisSemester,
    firstSeed: s.firstSeed >>> 0,
    currentSeed: s.currentSeed >>> 0,
    swaps: s.currentSwaps,
    selectedPerRequirement: s.selectedPerRequirement,
    selectedOptionsPerRequirement: s.selectedOptionsPerRequirement,
    constrainedPerRequirement: s.constrainedPerRequirement,
    requirementPriorities: s.requirementPriorities,
    requirementTreeWithStatus: s.requirementTreeWithStatus,
    remainingRequirements: s.remainingRequirements,
    includeClosedComponents: s.includeClosedComponents,
    virtualSectionsOnly: s.virtualSectionsOnly,
    studentPrograms: s.studentPrograms,
    wizardMode: s.calendarMode,
    basketCourses: s.basketCourses,
    basicElectivesCount: s.basicElectivesCount,
    basicExcludedCategories: s.basicExcludedCategories,
    requirementSlotsUserTouched: s.requirementSlotsUserTouched,
    generationMinStartMinutes: s.generationMinStartMinutes,
    generationMaxEndMinutes: s.generationMaxEndMinutes,
    generationPreferHigherProfessorRating: s.generationPreferHigherProfessorRating,
    generationLimitFirstYearCredits: s.generationLimitFirstYearCredits,
    generationCompressedSchedule: s.generationCompressedSchedule,
    generationPreferEasier: s.generationPreferEasier,
    generationPreferHigherSentiment: s.generationPreferHigherSentiment,
    activeStep: 0,
    showCalendar: false,
    frenchImmersionStream: s.frenchImmersionStream,
    calendarWeekIndex: s.calendarWeekIndex,
    blacklistedCourses: s.blacklistedCourses,
    blockedTimes: toBlockedWindows(s.blockedTimes),
  };
}

type LoadedCache = NonNullable<AppStore["cache"]>;
type DecodedCourseSelection = DecodedState["courseSelections"][number];

function remapProgramToYearCatalogue(
  program: Program | null,
  yearCataloguePrograms: AppStore["yearCataloguePrograms"],
): Program | null {
  if (program == null || yearCataloguePrograms == null) return program;

  const slug = urlToSlug(program.url);
  const yearProgram = yearCataloguePrograms.find((p) => urlToSlug(p.url) === slug);
  return yearProgram ?? program;
}

function cacheWithOptTransferCredits(
  baseCache: LoadedCache,
  completedCourseCodes: string[],
): LoadedCache {
  const optCodes = completedCourseCodes.map(normalizeCourseCode).filter(isOptCourse);
  if (optCodes.length === 0) return baseCache;

  return withExtraCourses(
    baseCache,
    optCodes.map((code): Course => ({ code, title: code, credits: 3, description: "" })),
  );
}

function buildRequirementIndex(
  decoded: DecodedState,
  program: Program | null,
  minorProgram: Program | null,
  cache: LoadedCache,
): Map<number, string> {
  const firstPass = recomputeStateForProgram(
    program,
    minorProgram,
    decoded.completedCourseCodes,
    cache,
    {},
    {},
    decoded.levelBuckets,
    decoded.languageBuckets,
    decoded.includeClosedComponents ?? true,
    decoded.studentPrograms,
    {},
  );
  const orderedReqIds = requirementIdsFromTree(firstPass.requirementTreeWithStatus);
  const reqIndexToId = new Map<number, string>();
  for (const [i, id] of orderedReqIds.entries()) reqIndexToId.set(i, id);
  return reqIndexToId;
}

function mapOptionSelections(
  optionSelections: DecodedState["optionSelections"],
  reqIndexToId: Map<number, string>,
): Record<string, number> {
  const selectedOptionsPerRequirement: Record<string, number> = {};
  for (const { reqIndex, optionIndex } of optionSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null) selectedOptionsPerRequirement[reqId] = optionIndex;
  }
  return selectedOptionsPerRequirement;
}

function filterValidDecodedCodes(courseCodes: string[], inCatalogue: Set<string>): string[] {
  return courseCodes.filter(
    (code) => isOptCourse(normalizeCourseCode(code)) || inCatalogue.has(code),
  );
}

function mapCourseSelections(
  selections: readonly DecodedCourseSelection[],
  reqIndexToId: Map<number, string>,
  inCatalogue: Set<string>,
): Record<string, string[]> {
  const byRequirement: Record<string, string[]> = {};
  for (const { reqIndex, courseCodes } of selections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    const valid = filterValidDecodedCodes(courseCodes, inCatalogue);
    if (valid.length > 0) byRequirement[reqId] = valid;
  }
  return byRequirement;
}

function appendConstrainedGroupSelections(
  constrainedPerRequirement: Record<string, string[]>,
  groupSelections: DecodedState["constrainedGroupSelections"],
  reqIndexToId: Map<number, string>,
): void {
  for (const { reqIndex, groupPrefixes } of groupSelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId == null) continue;
    const tokens = groupPrefixes.map((prefix) => makeGroupTokenInstance(prefix));
    constrainedPerRequirement[reqId] = [...(constrainedPerRequirement[reqId] ?? []), ...tokens];
  }
}

function mapTouchedRequirements(
  touchedReqIndices: DecodedState["touchedReqIndices"],
  reqIndexToId: Map<number, string>,
): Record<string, true> {
  return Object.fromEntries(
    touchedReqIndices
      .map((idx) => reqIndexToId.get(idx))
      .filter((id): id is string => id != null)
      .map((id) => [id, true as const]),
  );
}

function mapRequirementPriorities(
  prioritySelections: DecodedState["requirementPrioritySelections"],
  reqIndexToId: Map<number, string>,
): Record<string, number> {
  const requirementPriorities: Record<string, number> = {};
  for (const { reqIndex, priority } of prioritySelections) {
    const reqId = reqIndexToId.get(reqIndex);
    if (reqId != null && priority > 0) requirementPriorities[reqId] = priority;
  }
  return requirementPriorities;
}

function recomputeDecodedState(
  decoded: DecodedState,
  program: Program | null,
  minorProgram: Program | null,
  cache: LoadedCache,
  selectedPerRequirement: Record<string, string[]>,
  selectedOptionsPerRequirement: Record<string, number>,
  requirementSlotsUserTouched: Record<string, true>,
): ReturnType<typeof recomputeStateForProgram> {
  return recomputeStateForProgram(
    program,
    minorProgram,
    decoded.completedCourseCodes,
    cache,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    decoded.levelBuckets,
    decoded.languageBuckets,
    decoded.includeClosedComponents ?? true,
    decoded.studentPrograms,
    requirementSlotsUserTouched,
  );
}

export const createUrlSlice =
  (services: AppServices): StateCreator<AppStore, [], [], UrlSlice> =>
  (set, get) => ({
    loadEncodedState: (decoded) => {
      const { catalogue, indices, cache: baseCache, yearCataloguePrograms } = get();
      if (!catalogue || !baseCache || !indices) return;

      const program = remapProgramToYearCatalogue(decoded.program, yearCataloguePrograms);
      const minorProgram = remapProgramToYearCatalogue(
        decoded.minorProgram ?? null,
        yearCataloguePrograms,
      );
      const cache = cacheWithOptTransferCredits(baseCache, decoded.completedCourseCodes);
      const studentPrograms = decoded.studentPrograms;
      const reqIndexToId = buildRequirementIndex(decoded, program, minorProgram, cache);
      const selectedOptionsPerRequirement = mapOptionSelections(
        decoded.optionSelections,
        reqIndexToId,
      );
      const inCatalogue = new Set(catalogue.courses.map((c) => c.code));
      const selectedPerRequirement = mapCourseSelections(
        decoded.courseSelections,
        reqIndexToId,
        inCatalogue,
      );
      const constrainedPerRequirement = mapCourseSelections(
        decoded.constrainedSelections,
        reqIndexToId,
        inCatalogue,
      );
      appendConstrainedGroupSelections(
        constrainedPerRequirement,
        decoded.constrainedGroupSelections,
        reqIndexToId,
      );
      const requirementSlotsUserTouched = mapTouchedRequirements(
        decoded.touchedReqIndices,
        reqIndexToId,
      );
      const requirementPriorities = mapRequirementPriorities(
        decoded.requirementPrioritySelections,
        reqIndexToId,
      );
      const full = recomputeDecodedState(
        decoded,
        program,
        minorProgram,
        cache,
        selectedPerRequirement,
        selectedOptionsPerRequirement,
        requirementSlotsUserTouched,
      );

      set({
        program,
        minorProgram,
        studentPrograms,
        completedCourses: decoded.completedCourseCodes,
        cache,
        levelBuckets: decoded.levelBuckets,
        languageBuckets: decoded.languageBuckets,
        electiveLevelBuckets: decoded.electiveLevelBuckets,
        coursesThisSemester: decoded.coursesThisSemester,
        firstSeed: decoded.firstSeed >>> 0,
        currentSeed: decoded.currentSeed >>> 0,
        lowestVisitedSeed: inferLowestVisitedSeedFromPersisted(
          decoded.firstSeed >>> 0,
          decoded.currentSeed >>> 0,
        ),
        currentSwaps: decoded.swaps.map((swap) => ({
          ...swap,
          courseCode: normalizeCourseCode(swap.courseCode),
        })),
        swapsPerSeed: {},
        includeClosedComponents: decoded.includeClosedComponents ?? false,
        virtualSectionsOnly: decoded.virtualSectionsOnly ?? false,
        basketCourses: decoded.basketCourses,
        basicElectivesCount: decoded.basicElectivesCount,
        basicExcludedCategories: decoded.basicExcludedCategories,
        generationMinStartMinutes: decoded.generationMinStartMinutes,
        generationMaxEndMinutes: decoded.generationMaxEndMinutes,
        generationPreferHigherProfessorRating:
          decoded.generationPreferHigherProfessorRating ?? false,
        generationLimitFirstYearCredits: decoded.generationLimitFirstYearCredits,
        generationCompressedSchedule: decoded.generationCompressedSchedule,
        generationPreferEasier: decoded.generationPreferEasier,
        generationPreferHigherSentiment: decoded.generationPreferHigherSentiment ?? false,
        frenchImmersionStream: decoded.frenchImmersionStream ?? false,
        calendarWeekIndex: decoded.calendarWeekIndex ?? null,
        blacklistedCourses: decoded.blacklistedCourses ?? [],
        blockedTimes: withBlockedIds(decoded.blockedTimes ?? []),
        generationError: null,
        constrainedPerRequirement,
        requirementPriorities,
        ...(decoded.selectedTermId != null ? { selectedTermId: decoded.selectedTermId } : {}),
        ...(decoded.firstYear != null ? { firstYear: decoded.firstYear } : {}),
        requirementSlotsUserTouched,
        ...full,
      });
    },

    getEncodedStateBase64: () => {
      const s = get();
      if (!s.catalogue || !s.indices) return null;
      return encodeStateToBase64(buildEncodeInput(s), s.catalogue, s.indices);
    },

    getShareUrl: () => {
      const s = get();
      if (!s.catalogue || !s.indices) return null;
      const input = buildEncodeInput(s);
      const base64 = encodeStateToBase64(input, s.catalogue, s.indices);
      if (!base64) return null;
      return services.share.buildShareUrl({
        origin: services.share.getOrigin(),
        encodedStateBase64: base64,
        currentSchedule: s.currentSchedule,
        schedulesData: s.schedulesData,
        selectedTermId: s.selectedTermId,
      });
    },
  });
