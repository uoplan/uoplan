import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { recomputeStateForProgram, getDisciplineCodesForProgram } from "../requirementCompute";
import type { CourseLanguageBucket } from "@uoplan/core";
import { generateRandomSeed } from "@uoplan/core";
import { getMergedCatalogue } from "./catalogueUtils";
import { buildCacheWithOpt } from "../../lib/dataCacheLoader";
import { pruneOptionSelectionsForClear } from "../../lib/requirements/requirementUtils";
import {
  DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS,
  DEFAULT_BASIC_LANGUAGE_BUCKETS,
  DEFAULT_BASIC_LEVEL_BUCKETS,
} from "../../lib/electiveEligibility";
import {
  DEFAULT_COURSES_THIS_SEMESTER,
  DEFAULT_GENERATION_ALLOWED_DAYS,
  DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
  DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
  DEFAULT_GENERATION_MAX_END_MINUTES,
  DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
  DEFAULT_GENERATION_MIN_START_MINUTES,
  DEFAULT_GENERATION_PREFER_EASIER,
} from "../generationDefaults";

interface SelectionSlice {
  setBasicPinnedCourses: AppStore["setBasicPinnedCourses"];
  setBasicElectivesCount: AppStore["setBasicElectivesCount"];
  setBasicExcludedCategories: AppStore["setBasicExcludedCategories"];
  setProgram: AppStore["setProgram"];
  setMinorProgram: AppStore["setMinorProgram"];
  setStudentPrograms: AppStore["setStudentPrograms"];
  setCompletedCourses: AppStore["setCompletedCourses"];
  addCompletedCourse: AppStore["addCompletedCourse"];
  removeCompletedCourse: AppStore["removeCompletedCourse"];
  setSelectedForRequirement: AppStore["setSelectedForRequirement"];
  setConstrainedForRequirement: AppStore["setConstrainedForRequirement"];
  setSelectedOptionForRequirement: AppStore["setSelectedOptionForRequirement"];
  clearSelectedOptionForRequirement: AppStore["clearSelectedOptionForRequirement"];
  setCoursesThisSemester: AppStore["setCoursesThisSemester"];
  clearGenerationOptions: AppStore["clearGenerationOptions"];
  setLevelBuckets: AppStore["setLevelBuckets"];
  setLanguageBuckets: AppStore["setLanguageBuckets"];
  setElectiveLevelBuckets: AppStore["setElectiveLevelBuckets"];
  setFrenchImmersionStream: AppStore["setFrenchImmersionStream"];
}

export const createSelectionSlice: StateCreator<AppStore, [], [], SelectionSlice> = (set, get) => ({
  setBasicPinnedCourses: (courses) => set({ basicPinnedCourses: courses }),
  setBasicElectivesCount: (count) => set({ basicElectivesCount: count }),
  setBasicExcludedCategories: (categories) => set({ basicExcludedCategories: categories }),

  setProgram: (program) => {
    const studentPrograms = getDisciplineCodesForProgram(program);
    set({
      program,
      minorProgram: null, // Clear minor when main program changes
      studentPrograms,
      constrainedPerRequirement: {},
      requirementSlotsUserTouched: {},
    });
    const { cache, completedCourses, levelBuckets, languageBuckets, includeClosedComponents } =
      get();
    const state = recomputeStateForProgram(
      program,
      null, // minor is null
      completedCourses,
      cache,
      {},
      {},
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      {},
    );
    set(state);
  },

  setMinorProgram: (minorProgram) => {
    set({
      minorProgram,
      constrainedPerRequirement: {},
      requirementSlotsUserTouched: {},
    });
    const {
      program,
      cache,
      completedCourses,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      {},
      {},
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      {},
    );
    set(state);
  },

  setStudentPrograms: (programs) => {
    set({ studentPrograms: programs });
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      requirementSlotsUserTouched,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      programs,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  setCompletedCourses: (courses) => {
    set({ completedCourses: courses });
    const { catalogue, yearCatalogueCourses, schedulesData } = get();
    if (yearCatalogueCourses && catalogue && schedulesData) {
      const effectiveCatalogue = getMergedCatalogue(catalogue, yearCatalogueCourses, courses);
      if (effectiveCatalogue) {
        const newCache = buildCacheWithOpt(effectiveCatalogue, schedulesData, courses);
        set({ cache: newCache });
      }
    } else if (catalogue && schedulesData) {
      // No year catalogue: rebuild from the latest catalogue so OPT entries stay
      // in sync with the current completed-course list.
      const newCache = buildCacheWithOpt(catalogue, schedulesData, courses);
      set({ cache: newCache });
    }
    const {
      program,
      minorProgram,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();

    const state = recomputeStateForProgram(
      program,
      minorProgram,
      courses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  addCompletedCourse: (code) => {
    const { completedCourses } = get();
    if (completedCourses.includes(code)) return;
    get().setCompletedCourses([...completedCourses, code]);
  },

  removeCompletedCourse: (code) => {
    const { completedCourses } = get();
    get().setCompletedCourses(completedCourses.filter((c) => c !== code));
  },

  setSelectedForRequirement: (requirementId, courses) => {
    const prev = get().selectedPerRequirement;
    const selectedPerRequirementNext = { ...prev, [requirementId]: courses };
    const requirementSlotsUserTouchedNext: Record<string, true> = {
      ...get().requirementSlotsUserTouched,
      [requirementId]: true as const,
    };
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirementNext,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouchedNext,
    );
    set({ ...state, requirementSlotsUserTouched: requirementSlotsUserTouchedNext });
  },

  setLevelBuckets: (buckets) => {
    set({ levelBuckets: buckets });
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      buckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  setLanguageBuckets: (buckets) => {
    set({ languageBuckets: buckets });
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      buckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  setElectiveLevelBuckets: (buckets) => {
    set({ electiveLevelBuckets: buckets });
  },

  setFrenchImmersionStream: (enabled) => {
    if (!enabled) {
      set({ frenchImmersionStream: false });
      return;
    }
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();
    const nextLang: CourseLanguageBucket[] = languageBuckets.includes("fr")
      ? languageBuckets
      : [...languageBuckets, "fr"];

    // Basic mode does not use requirement-tree / filtered-prereq state on the calendar;
    // skipping the full recompute avoids scanning the entire catalogue on toggle (UI freeze).
    if (get().calendarMode === "basic") {
      set({ frenchImmersionStream: true, languageBuckets: nextLang });
      return;
    }

    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      levelBuckets,
      nextLang,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set({ ...state, frenchImmersionStream: true, languageBuckets: nextLang });
  },

  setSelectedOptionForRequirement: (requirementId, optionIndex) => {
    const selectedOptionsPerRequirementNext = {
      ...get().selectedOptionsPerRequirement,
      [requirementId]: optionIndex,
    };
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirementNext,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  clearSelectedOptionForRequirement: (requirementId) => {
    const selectedOptionsPerRequirementNext = pruneOptionSelectionsForClear(
      get().selectedOptionsPerRequirement,
      requirementId,
    );
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    } = get();
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirementNext,
      levelBuckets,
      languageBuckets,
      includeClosedComponents,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },

  setConstrainedForRequirement: (requirementId, courses) => {
    set((s) => ({
      constrainedPerRequirement: {
        ...s.constrainedPerRequirement,
        [requirementId]: courses,
      },
    }));
  },

  setCoursesThisSemester: (n) => set({ coursesThisSemester: n }),

  clearGenerationOptions: () => {
    const {
      program,
      minorProgram,
      cache,
      completedCourses,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      studentPrograms,
      requirementSlotsUserTouched,
      frenchImmersionStream,
    } = get();

    // Keep "fr" in the language buckets while the French immersion stream is on, mirroring
    // the invariant maintained by setFrenchImmersionStream (which is not reset here).
    const defaultLanguageBuckets: CourseLanguageBucket[] = frenchImmersionStream
      ? [...DEFAULT_BASIC_LANGUAGE_BUCKETS, "fr"]
      : [...DEFAULT_BASIC_LANGUAGE_BUCKETS];

    // Section/component visibility filters changed, so drop the memoised enrollments.
    get().clearEnrollmentsCache();

    set({
      coursesThisSemester: DEFAULT_COURSES_THIS_SEMESTER,
      generationMinStartMinutes: DEFAULT_GENERATION_MIN_START_MINUTES,
      generationMaxEndMinutes: DEFAULT_GENERATION_MAX_END_MINUTES,
      generationAllowedDays: [...DEFAULT_GENERATION_ALLOWED_DAYS],
      generationMinProfessorRating: DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
      generationLimitFirstYearCredits: DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
      generationCompressedSchedule: DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
      generationPreferEasier: DEFAULT_GENERATION_PREFER_EASIER,
      blacklistedCourses: [],
      blockedTimes: [],
      levelBuckets: [...DEFAULT_BASIC_LEVEL_BUCKETS],
      languageBuckets: defaultLanguageBuckets,
      electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
      includeClosedComponents: false,
      virtualSectionsOnly: false,
      constrainedPerRequirement: {},
      currentSchedule: null,
      currentPoolMap: {},
      currentColorMap: {},
      currentSwaps: [],
      swapsPerSeed: {},
      swapPool: [],
      chosenCourseToRequirementId: {},
      generationError: null,
      firstSeed: generateRandomSeed(),
      currentSeed: 0,
      lowestVisitedSeed: null,
      scheduleNoVariety: false,
    });

    // Buckets / closed-component visibility feed the requirement tree and eligible-course
    // pools, so recompute them with the defaults (user requirement picks are preserved).
    const state = recomputeStateForProgram(
      program,
      minorProgram,
      completedCourses,
      cache,
      selectedPerRequirement,
      selectedOptionsPerRequirement,
      [...DEFAULT_BASIC_LEVEL_BUCKETS],
      defaultLanguageBuckets,
      false,
      studentPrograms,
      requirementSlotsUserTouched,
    );
    set(state);
  },
});
