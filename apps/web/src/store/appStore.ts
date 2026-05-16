import { create } from "zustand";
import { generateRandomSeed } from "schedule";
import type { AppStore } from "./types";
import { LOCAL_STORAGE_KEY } from "./constants";
import {
  createUrlSlice,
  createDataSlice,
  createConstraintsSlice,
  createSchedulesSlice,
  createSelectionSlice,
} from "./slices/index";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
} from "../lib/electiveEligibility";

export const useAppStore = create<AppStore>()((...a) => {
  const [set, get] = a;

  return {
    // Merge slices
    ...createDataSlice(...a),
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
    basicPinnedCourses: [],
    basicElectivesCount: 0,
    basicExcludedCategories: [],
    studentPrograms: [],
    completedCourses: [],
    remainingRequirements: [],
    requirementTreeWithStatus: [],
    completedRequirementsList: [],
    selectedPerRequirement: {},
    requirementSlotsUserTouched: {},
    selectedOptionsPerRequirement: {},
    constrainedPerRequirement: {},
    coursesThisSemester: 5,
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
    currentSeed: 0, // Will be set to firstSeed when first generated
    lowestVisitedSeed: null,
    generationMinStartMinutes: 8 * 60 + 30, // 8:30
    generationMaxEndMinutes: 22 * 60, // 22:00
    generationAllowedDays: ["Mo", "Tu", "We", "Th", "Fr"],
    includeClosedComponents: false,
    virtualSectionsOnly: false,
    generationMinProfessorRating: null,
    professorRatings: null,
    generationLimitFirstYearCredits: true,
    generationCompressedSchedule: false,
    generationPreferEasier: false,
    wizardFurthestStep: 0,
    frenchImmersionStream: false,

    touchWizardFurthestStep: (step) => {
      set((s) => ({
        wizardFurthestStep: Math.max(s.wizardFurthestStep, step),
      }));
    },

    resetWizardFurthestStep: () => {
      set({ wizardFurthestStep: 0 });
    },

    // Global action: touches many states
    resetToDefault: () => {
      const {
        catalogue,
        indices,
        schedulesData,
        cache,
        courseGrades,
        courseGradesError,
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
        loading,
        loadProgress,
        error,
        availableYears,
        firstYear: null,
        basicPinnedCourses: [],
        basicElectivesCount: 0,
        basicExcludedCategories: [],
        yearCataloguePrograms: null,
        yearCatalogueCourses: null,
        yearCatalogueLoading: false,
        program: null,
        minorProgram: null,
        completedCourses: [],
        remainingRequirements: [],
        requirementTreeWithStatus: [],
        completedRequirementsList: [],
        selectedPerRequirement: {},
        requirementSlotsUserTouched: {},
        selectedOptionsPerRequirement: {},
        constrainedPerRequirement: {},
        coursesThisSemester: 5,
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
        wizardFurthestStep: 0,
        frenchImmersionStream: false,
      });
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    },
  };
});
