import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { createContext, useContext } from "react";
import { generateRandomSeed } from "@uoplan/core";
import type { AppStore } from "./types";
import { LOCAL_STORAGE_KEY } from "./constants";
import {
  createConstraintsSlice,
  createDataSlice,
  createSchedulesSlice,
  createSelectionSlice,
  createUrlSlice,
} from "./slices/index";
import { createDefaultAppServices } from "./services";
import type { AppServices } from "./services";
import { registerAppStore } from "./storeRegistry";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
} from "../lib/electiveEligibility";
import {
  DEFAULT_BASIC_ELECTIVES_COUNT,
  DEFAULT_COURSES_THIS_SEMESTER,
  DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
  DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
  DEFAULT_GENERATION_MAX_END_MINUTES,
  DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
  DEFAULT_GENERATION_MIN_START_MINUTES,
  DEFAULT_GENERATION_PREFER_EASIER,
  DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT,
} from "./generationDefaults";
import { defaultBlockedTimes } from "../lib/blockedTimes";

export type AppStoreApi = StoreApi<AppStore>;

function createPlannerStateDefaults() {
  return {
    basketCourses: [],
    basicElectivesCount: DEFAULT_BASIC_ELECTIVES_COUNT,
    basicExcludedCategories: [],
    completedCourses: [],
    remainingRequirements: [],
    requirementTreeWithStatus: [],
    completedRequirementsList: [],
    selectedPerRequirement: {},
    requirementSlotsUserTouched: {},
    selectedOptionsPerRequirement: {},
    constrainedPerRequirement: {},
    autoConstrainedPerRequirement: {},
    requirementPriorities: {},
    coursesThisSemester: DEFAULT_COURSES_THIS_SEMESTER,
    prereqEligibleCourses: [],
    filteredPrereqEligibleCourses: [],
    levelBuckets: [...DEFAULT_BASIC_LEVEL_BUCKETS],
    languageBuckets: [...DEFAULT_BASIC_LANGUAGE_BUCKETS],
    electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
    currentSchedule: null,
    scheduleGenerating: false,
    swapPool: [],
    chosenCourseToRequirementId: {},
    currentPoolMap: {},
    currentColorMap: {},
    generationError: null,
    unassignedCompletedCourses: [],
    currentSwaps: [],
    firstSeed: generateRandomSeed(),
    currentSeed: 0,
    lowestVisitedSeed: null,
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    frenchImmersionStream: false,
    calendarWeekIndex: null,
    blacklistedCourses: [],
  };
}

/**
 * Build an isolated app store. Services (navigation, …) are injected so tests and the OG
 * worker can supply fakes; production uses {@link createDefaultAppServices}.
 */
export function createAppStore(services: AppServices = createDefaultAppServices()): AppStoreApi {
  return createStore<AppStore>()((...a) => {
    const [set, get] = a;

    return {
      // Merge slices
      ...createDataSlice(services)(...a),
      ...createUrlSlice(...a),
      ...createSelectionSlice(...a),
      ...createConstraintsSlice(...a),
      ...createSchedulesSlice(...a),

      // Initial State values that are cross-slice or global defaults
      catalogue: null,
      indices: null,
      schedulesData: null,
      cache: null,
      courseGrades: null,
      courseGradesError: null,
      // Defaults to true: grade data is lazily loaded, so "not fetched yet" must
      // read as loading to consumers (e.g. explore redirect guards) until the
      // lazy `ensureCourseGrades` resolves it to false.
      courseGradesLoading: true,
      disciplines: null,
      faculties: null,
      professors: null,
      // Defaults to true (like courseGradesLoading): the registry is lazily
      // loaded, so "not fetched yet" reads as loading until ensureProfessors
      // settles (success or optional-asset-absent).
      professorsLoading: true,
      loading: false,
      loadProgress: 0,
      error: null,
      terms: null,
      selectedTermId: null,
      availableYears: [],
      firstYear: null,
      yearCataloguePrograms: null,
      yearCatalogueCourses: null,
      yearCatalogueLoading: false,
      program: null,
      minorProgram: null,
      studentPrograms: [],
      ...createPlannerStateDefaults(),
      swapsPerSeed: {},
      // currentSeed will be set to firstSeed when first generated.
      generationMinStartMinutes: DEFAULT_GENERATION_MIN_START_MINUTES,
      generationMaxEndMinutes: DEFAULT_GENERATION_MAX_END_MINUTES,
      generationMinProfessorRating: DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
      professorRatings: null,
      // Defaults to true (like courseGradesLoading): ratings are lazily loaded,
      // so "not fetched yet" reads as loading until ensureProfessorRatings
      // settles (success or optional-asset-absent).
      professorRatingsLoading: true,
      generationLimitFirstYearCredits: DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
      generationCompressedSchedule: DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
      generationPreferEasier: DEFAULT_GENERATION_PREFER_EASIER,
      generationPreferHigherSentiment: DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT,
      courseSentimentByNorm: null,
      calendarMode: null,
      scheduleNoVariety: false,
      generationOptionsDirty: false,
      blockedTimes: defaultBlockedTimes(),
      lastSavedAt: null,
      hasPendingSave: false,
      pendingSharedState: null,

      setCalendarWeekIndex: (index) => set({ calendarWeekIndex: index }),
      setCalendarMode: (mode) => set({ calendarMode: mode }),

      // Global action: touches many states
      resetToDefault: () => {
        const {
          catalogue,
          indices,
          schedulesData,
          cache,
          courseGrades,
          courseGradesError,
          courseGradesLoading,
          disciplines,
          loading,
          loadProgress,
          error,
          availableYears,
        } = get();
        set({
          catalogue,
          indices,
          schedulesData,
          cache,
          courseGrades,
          courseGradesError,
          courseGradesLoading,
          disciplines,
          loading,
          loadProgress,
          error,
          availableYears,
          firstYear: null,
          yearCataloguePrograms: null,
          yearCatalogueCourses: null,
          yearCatalogueLoading: false,
          program: null,
          minorProgram: null,
          ...createPlannerStateDefaults(),
          blockedTimes: [],
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      },
    };
  });
}

/** Default singleton store used by the running app and by non-React/imperative callers. */
export const defaultAppStore = createAppStore();
registerAppStore(defaultAppStore);

/**
 * Context holding the active store instance. Provided by {@link AppStoreProvider}; there is no
 * silent singleton fallback so a missing provider fails loudly (keeps tests truly isolated).
 */
export const AppStoreContext = createContext<AppStoreApi | null>(null);

/** Subscribe to the active store with a selector. Requires an {@link AppStoreProvider} ancestor. */
export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore must be used within <AppStoreProvider>");
  }
  return useStore(store, selector);
}

/** Access the active store instance for imperative reads/writes inside React. */
export function useAppStoreApi(): AppStoreApi {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStoreApi must be used within <AppStoreProvider>");
  }
  return store;
}
