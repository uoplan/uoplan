import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import { getDisciplineCodesForProgram, recomputeStateForProgram } from "../requirementCompute";
import type { CourseLanguageBucket } from "@uoplan/core";
import {
  generateRandomSeed,
  isRepeatableCourse,
  normalizeCourseCode,
  parseCourseCode,
} from "@uoplan/core";
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
  DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
  DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
  DEFAULT_GENERATION_MAX_END_MINUTES,
  DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
  DEFAULT_GENERATION_MIN_START_MINUTES,
  DEFAULT_GENERATION_PREFER_EASIER,
  DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT,
} from "../generationDefaults";
import { defaultBlockedTimes } from "../../lib/blockedTimes";

/** Structural equality for `Record<string, string[]>` (same keys, same arrays in order). */
function shallowRecordEqual(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const av = a[key];
    const bv = b[key];
    if (!bv || av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) return false;
    }
  }
  return true;
}

function hasFlsCourse(courses: string[]): boolean {
  return courses.some((code) => parseCourseCode(code)?.discipline === "FLS");
}

function recomputeStateForSelectedOptions(
  store: AppStore,
  selectedOptionsPerRequirementNext: AppStore["selectedOptionsPerRequirement"],
) {
  return recomputeStateForProgram(
    store.program,
    store.minorProgram,
    store.completedCourses,
    store.cache,
    store.selectedPerRequirement,
    selectedOptionsPerRequirementNext,
    store.levelBuckets,
    store.languageBuckets,
    store.includeClosedComponents,
    store.studentPrograms,
    store.requirementSlotsUserTouched,
  );
}

interface SelectionSlice {
  setBasketCourses: AppStore["setBasketCourses"];
  addToBasket: AppStore["addToBasket"];
  removeFromBasket: AppStore["removeFromBasket"];
  toggleBasket: AppStore["toggleBasket"];
  clearBasket: AppStore["clearBasket"];
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
  setRequirementPriorities: AppStore["setRequirementPriorities"];
  applyDesiredAutoAssignments: AppStore["applyDesiredAutoAssignments"];
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
  setBasketCourses: (courses) => set({ basketCourses: courses, generationOptionsDirty: true }),
  addToBasket: (code) => {
    const { basketCourses } = get();
    if (basketCourses.includes(code)) return;
    get().setBasketCourses([...basketCourses, code]);
  },
  removeFromBasket: (code) => {
    const { basketCourses } = get();
    if (!basketCourses.includes(code)) return;
    get().setBasketCourses(basketCourses.filter((c) => c !== code));
  },
  toggleBasket: (code) => {
    const { basketCourses } = get();
    get().setBasketCourses(
      basketCourses.includes(code)
        ? basketCourses.filter((c) => c !== code)
        : [...basketCourses, code],
    );
  },
  clearBasket: () => get().setBasketCourses([]),
  setBasicElectivesCount: (count) =>
    set({ basicElectivesCount: count, generationOptionsDirty: true }),
  setBasicExcludedCategories: (categories) =>
    set({ basicExcludedCategories: categories, generationOptionsDirty: true }),

  setProgram: (program) => {
    const studentPrograms = getDisciplineCodesForProgram(program);
    set({
      program,
      minorProgram: null, // Clear minor when main program changes
      studentPrograms,
      constrainedPerRequirement: {},
      autoConstrainedPerRequirement: {},
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
      autoConstrainedPerRequirement: {},
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
    const hadFlsCourse = hasFlsCourse(get().completedCourses);
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
    set({ ...state, generationOptionsDirty: true });
    if (!hadFlsCourse && hasFlsCourse(courses) && !get().frenchImmersionStream) {
      get().setFrenchImmersionStream(true);
    }
  },

  addCompletedCourse: (code) => {
    const { completedCourses } = get();
    // Repeatable courses (e.g. accompanying FLS companions) may be added more than once,
    // since each instance can satisfy a different requirement slot.
    if (completedCourses.includes(code) && !isRepeatableCourse(code)) return;
    get().setCompletedCourses([...completedCourses, code]);
  },

  removeCompletedCourse: (code) => {
    const { completedCourses } = get();
    // Remove a single instance so repeated courses can be decremented one at a time.
    const idx = completedCourses.indexOf(code);
    if (idx === -1) {
      get().setCompletedCourses(completedCourses.filter((c) => c !== code));
      return;
    }
    get().setCompletedCourses([
      ...completedCourses.slice(0, idx),
      ...completedCourses.slice(idx + 1),
    ]);
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
    set({
      ...state,
      requirementSlotsUserTouched: requirementSlotsUserTouchedNext,
      generationOptionsDirty: true,
    });
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
    set({ ...state, generationOptionsDirty: true });
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
    set({ ...state, generationOptionsDirty: true });
  },

  setElectiveLevelBuckets: (buckets) => {
    set({ electiveLevelBuckets: buckets, generationOptionsDirty: true });
  },

  setFrenchImmersionStream: (enabled) => {
    if (!enabled) {
      set({ frenchImmersionStream: false, generationOptionsDirty: true });
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
      set({ frenchImmersionStream: true, languageBuckets: nextLang, generationOptionsDirty: true });
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
    set({
      ...state,
      frenchImmersionStream: true,
      languageBuckets: nextLang,
      generationOptionsDirty: true,
    });
  },

  setSelectedOptionForRequirement: (requirementId, optionIndex) => {
    const selectedOptionsPerRequirementNext = {
      ...get().selectedOptionsPerRequirement,
      [requirementId]: optionIndex,
    };
    const state = recomputeStateForSelectedOptions(get(), selectedOptionsPerRequirementNext);
    set({ ...state, generationOptionsDirty: true });
  },

  clearSelectedOptionForRequirement: (requirementId) => {
    const selectedOptionsPerRequirementNext = pruneOptionSelectionsForClear(
      get().selectedOptionsPerRequirement,
      requirementId,
    );
    const state = recomputeStateForSelectedOptions(get(), selectedOptionsPerRequirementNext);
    set({ ...state, generationOptionsDirty: true });
  },

  setConstrainedForRequirement: (requirementId, courses) => {
    set((s) => ({
      constrainedPerRequirement: {
        ...s.constrainedPerRequirement,
        [requirementId]: courses,
      },
      generationOptionsDirty: true,
    }));
  },

  setRequirementPriorities: (updates) => {
    set((s) => {
      const next: Record<string, number> = { ...s.requirementPriorities };
      let changed = false;
      for (const [reqId, priority] of Object.entries(updates)) {
        const value = Math.max(0, Math.trunc(priority));
        if (value <= 0) {
          if (next[reqId] !== undefined) {
            delete next[reqId];
            changed = true;
          }
        } else if (next[reqId] !== value) {
          next[reqId] = value;
          changed = true;
        }
      }
      if (!changed) return {};
      return { requirementPriorities: next, generationOptionsDirty: true };
    });
  },

  applyDesiredAutoAssignments: (assigned) => {
    set((s) => {
      const prevAuto = s.autoConstrainedPerRequirement;
      const nextConstrained: Record<string, string[]> = { ...s.constrainedPerRequirement };
      const nextAuto: Record<string, string[]> = {};

      const reqIds = new Set([...Object.keys(prevAuto), ...Object.keys(assigned)]);
      for (const reqId of reqIds) {
        const prevAutoNorm = new Set((prevAuto[reqId] ?? []).map((c) => normalizeCourseCode(c)));
        // Manual picks = whatever is constrained today minus what we auto-added last time.
        const manualBase = (s.constrainedPerRequirement[reqId] ?? []).filter(
          (c) => !prevAutoNorm.has(normalizeCourseCode(c)),
        );
        const manualNorm = new Set(manualBase.map((c) => normalizeCourseCode(c)));

        // Only track as auto the assigned courses that aren't already manual picks, so removing a
        // desired course never clobbers a course the user locked manually.
        const autoAdd: string[] = [];
        for (const code of assigned[reqId] ?? []) {
          const norm = normalizeCourseCode(code);
          if (manualNorm.has(norm) || autoAdd.some((c) => normalizeCourseCode(c) === norm))
            continue;
          autoAdd.push(code);
        }

        const merged = [...manualBase, ...autoAdd];
        if (merged.length > 0) nextConstrained[reqId] = merged;
        else delete nextConstrained[reqId];
        if (autoAdd.length > 0) nextAuto[reqId] = autoAdd;
      }

      if (
        shallowRecordEqual(nextConstrained, s.constrainedPerRequirement) &&
        shallowRecordEqual(nextAuto, prevAuto)
      ) {
        return {};
      }
      return {
        constrainedPerRequirement: nextConstrained,
        autoConstrainedPerRequirement: nextAuto,
      };
    });
  },

  setCoursesThisSemester: (n) => set({ coursesThisSemester: n, generationOptionsDirty: true }),

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
      basketCourses: [],
      basicExcludedCategories: [],
      generationMinStartMinutes: DEFAULT_GENERATION_MIN_START_MINUTES,
      generationMaxEndMinutes: DEFAULT_GENERATION_MAX_END_MINUTES,
      generationMinProfessorRating: DEFAULT_GENERATION_MIN_PROFESSOR_RATING,
      generationLimitFirstYearCredits: DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS,
      generationCompressedSchedule: DEFAULT_GENERATION_COMPRESSED_SCHEDULE,
      generationPreferEasier: DEFAULT_GENERATION_PREFER_EASIER,
      generationPreferHigherSentiment: DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT,
      blacklistedCourses: [],
      blockedTimes: defaultBlockedTimes(),
      levelBuckets: [...DEFAULT_BASIC_LEVEL_BUCKETS],
      languageBuckets: defaultLanguageBuckets,
      electiveLevelBuckets: [...DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS],
      includeClosedComponents: false,
      virtualSectionsOnly: false,
      constrainedPerRequirement: {},
      autoConstrainedPerRequirement: {},
      requirementPriorities: {},
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
      generationOptionsDirty: false,
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
