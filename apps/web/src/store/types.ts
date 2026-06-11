import type {
  Catalogue,
  CompletedRequirementItem,
  Course,
  CourseGradesData,
  CourseLanguageBucket,
  CourseLevelBucket,
  DataCache,
  DayOfWeek,
  DecodedState,
  Discipline,
  GeneratedSchedule,
  Indices,
  LeadDescriptor,
  NormalizedCourseCode,
  ProfessorRatingsMap,
  ProfessorRegistry,
  Program,
  RemainingRequirement,
  RequirementWithStatus,
  SchedulesData,
  Term,
  TimetableFailureDiagnostics,
} from "@uoplan/core";

/** A user-blocked recurring weekday window on the calendar. `id` is local-only (React keys). */
export interface BlockedTime {
  id: string;
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Locale-agnostic description of an active, non-default generation filter.
 * Produced in the (locale-less) schedule worker and translated at render time
 * on the main thread, so no `tr()` call ever happens off the main thread.
 */
export type FilterHintDescriptor =
  | { code: "start-after"; time: string }
  | { code: "end-before"; time: string }
  | { code: "days-excluded"; days: string[] }
  | { code: "prof-rating"; rating: number }
  | { code: "virtual-only" }
  | { code: "closed-excluded" }
  | { code: "language-filter"; langs: string[] };

/**
 * Locale-agnostic description of the primary generation-error headline.
 * Translated on the main thread (see `formatGenerationMessage`).
 */
export type GenerationMessageDescriptor =
  | { kind: "lead"; lead: LeadDescriptor }
  | { kind: "unassigned-completed"; count: number; preview: string[]; overflow: number }
  | { kind: "complete-assign" }
  | { kind: "not-enough-courses" }
  | { kind: "timeout" };

export interface GenerationErrorDetails {
  emptyPools: Array<{ label: string; requirementId?: string; candidateCourses?: string[] }>;
  totalAvailable: number;
  totalNeeded: number;
  timetableFailure?: TimetableFailureDiagnostics;
  /** Non-default filters that may be restricting results (translated at render). */
  activeFilterHints?: FilterHintDescriptor[];
}

/** Primary message plus optional structured context for the expandable Details panel. */
export type GenerationErrorState = {
  message: GenerationMessageDescriptor;
  details: GenerationErrorDetails | null;
};

/** Which planner variant is active on the calendar route. */
export type CalendarVariant = "basic" | "advanced";

export interface AppState {
  pendingSharedState: DecodedState | null;
  basicPinnedCourses: string[];
  basicElectivesCount: number;
  basicExcludedCategories: string[];

  catalogue: Catalogue | null;
  indices: Indices | null;
  schedulesData: SchedulesData | null;
  cache: DataCache | null;
  courseGrades: CourseGradesData | null;
  courseGradesError: string | null;
  /** True while the lazily-loaded {@link courseGrades} asset is being fetched/decoded. */
  courseGradesLoading: boolean;
  disciplines: Discipline[] | null;
  /** Canonical professor registry (slug/legacyId lookups), lazily loaded from `professors.pb`. */
  professors: ProfessorRegistry | null;
  loading: boolean;
  /** 0–100 while {@link loading} is true. */
  loadProgress: number;
  error: string | null;

  terms: Term[] | null;
  selectedTermId: string | null;

  availableYears: number[];
  firstYear: number | null;
  yearCataloguePrograms: Program[] | null;
  yearCatalogueCourses: Course[] | null;
  yearCatalogueLoading: boolean;

  program: Program | null;
  minorProgram: Program | null;
  studentPrograms: string[];
  completedCourses: string[];
  remainingRequirements: RemainingRequirement[];
  requirementTreeWithStatus: RequirementWithStatus[];
  completedRequirementsList: CompletedRequirementItem[];
  selectedPerRequirement: Record<string, string[]>;
  /** Requirement ids the user explicitly set via Assign (not auto-filled). */
  requirementSlotsUserTouched: Record<string, true>;
  selectedOptionsPerRequirement: Record<string, number>;
  constrainedPerRequirement: Record<string, string[]>;
  /**
   * User-assigned generation priority per requirement id (default `0`). The scheduler only offers
   * courses from the lowest priority tier still outstanding, so a higher number defers a
   * requirement until everything below it is satisfied. Set on a group, it is stamped onto every
   * descendant pool. Absent keys mean priority `0`.
   */
  requirementPriorities: Record<string, number>;
  /**
   * Courses written into `constrainedPerRequirement` automatically from the unified "courses you
   * want" list (advanced mode), tracked separately so they can be reconciled/removed without
   * clobbering the user's manual constraint picks.
   */
  autoConstrainedPerRequirement: Record<string, string[]>;
  coursesThisSemester: number;
  prereqEligibleCourses: string[];
  filteredPrereqEligibleCourses: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  currentSchedule: GeneratedSchedule | null;
  /** True while generateSchedules / seed navigation is in flight. */
  scheduleGenerating: boolean;
  swapPool: string[];
  chosenCourseToRequirementId: Record<string, string>;
  currentPoolMap: Record<string, string>;
  /** Map of courseCode → colorIndex (0–7) for current schedule. */
  currentColorMap: Record<string, number>;
  generationError: GenerationErrorState | null;
  unassignedCompletedCourses: string[];
  /** Swaps applied to current schedule, indexed by enrollment position. */
  currentSwaps: Array<{ enrollmentIndex: number; courseCode: NormalizedCourseCode }>;
  /** Per-seed swap history; preserved when navigating prev/next, cleared on randomize. */
  swapsPerSeed: Record<
    number,
    Array<{ enrollmentIndex: number; courseCode: NormalizedCourseCode }>
  >;
  firstSeed: number;
  currentSeed: number;
  /** Earliest seed the user has generated at this session; drives Previous availability. */
  lowestVisitedSeed: number | null;
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationMinProfessorRating: number | null;
  professorRatings: ProfessorRatingsMap | null;
  includeClosedComponents: boolean;
  /** When true, only virtual meeting times are kept per section for scheduling. */
  virtualSectionsOnly: boolean;
  generationLimitFirstYearCredits: boolean;
  generationCompressedSchedule: boolean;
  /** Bias pool picks toward courses with higher historical grade averages. */
  generationPreferEasier: boolean;
  /** Bias pool picks toward courses with higher overall feedback sentiment. */
  generationPreferHigherSentiment: boolean;
  /**
   * Overall course-feedback sentiment (1-5) keyed by normalized course code, lazily
   * built from the feedback dataset when {@link generationPreferHigherSentiment} is on.
   * Null until loaded; consumed only by schedule generation.
   */
  courseSentimentByNorm: Map<NormalizedCourseCode, number> | null;
  frenchImmersionStream: boolean;
  /** The week group index the user last navigated to in the calendar, for URL sharing. */
  calendarWeekIndex: number | null;
  /**
   * Which planner variant is currently active on the calendar route, or null when
   * the calendar is not mounted. Drives generation-mode branching and share encoding.
   */
  calendarMode: CalendarVariant | null;
  /** True when the last seed navigation returned the same course set as the current schedule. */
  scheduleNoVariety: boolean;
  /**
   * True when a generation option has changed since the last generation. Drives the
   * calendar "Next" → "Generate" relabel. Ephemeral UI state, not persisted to the URL.
   */
  generationOptionsDirty: boolean;
  /** Courses that must never appear in any generated schedule. */
  blacklistedCourses: string[];
  /** Recurring per-weekday windows that no generated course may overlap. */
  blockedTimes: BlockedTime[];
  /** Timestamp (Date.now()) of the last successful localStorage flush. Null before first save. */
  lastSavedAt: number | null;
  /** True when tracked state has changed since the last localStorage flush. */
  hasPendingSave: boolean;
}

export interface AppActions {
  setBasicPinnedCourses: (courses: string[]) => void;
  setBasicElectivesCount: (count: number) => void;
  setBasicExcludedCategories: (categories: string[]) => void;
  generateBasicSchedules: () => Promise<void>;

  loadData: () => Promise<void>;
  /** Lazily fetch + decode `grades.pb`, then re-enrich schedules + rebuild the cache. Idempotent. */
  ensureCourseGrades: () => Promise<void>;
  /** Lazily fetch + decode `ratemyprofessors.pb` into the professor-ratings map. Idempotent. */
  ensureProfessorRatings: () => Promise<void>;
  /** Lazily fetch + decode `disciplines.pb`. Idempotent. */
  ensureDisciplines: () => Promise<void>;
  /** Lazily fetch + decode `professors.pb` into the canonical registry. Idempotent. */
  ensureProfessors: () => Promise<void>;
  /** Lazily load the year-specific catalogue for the current `firstYear` and recompute. Idempotent. */
  ensureYearCatalogue: () => Promise<void>;
  setSelectedTermId: (termId: string) => Promise<void>;
  setFirstYear: (year: number | null) => Promise<void>;
  loadEncodedState: (decoded: DecodedState) => void;
  acceptSharedState: () => void;
  dismissSharedState: () => void;
  getShareUrl: () => string | null;
  getEncodedStateBase64: () => string | null;
  setProgram: (program: Program | null) => void;
  setMinorProgram: (program: Program | null) => void;
  setStudentPrograms: (programs: string[]) => void;
  setCompletedCourses: (courses: string[]) => void;
  addCompletedCourse: (code: string) => void;
  removeCompletedCourse: (code: string) => void;
  setSelectedForRequirement: (requirementId: string, courses: string[]) => void;
  setConstrainedForRequirement: (requirementId: string, courses: string[]) => void;
  /**
   * Merge requirement-priority updates (requirementId → priority). A priority of `0` clears the
   * entry. Used to stamp a group's chosen priority onto all of its descendant pools.
   */
  setRequirementPriorities: (updates: Record<string, number>) => void;
  /**
   * Reconcile auto-assigned desired courses into `constrainedPerRequirement`, preserving manual
   * picks. `assigned` is keyed by requirement id (the resolver output); previously auto-added
   * courses no longer present are removed.
   */
  applyDesiredAutoAssignments: (assigned: Record<string, string[]>) => void;
  setSelectedOptionForRequirement: (requirementId: string, optionIndex: number) => void;
  clearSelectedOptionForRequirement: (requirementId: string) => void;
  setCoursesThisSemester: (n: number) => void;
  setGenerationMinStartMinutes: (minutes: number) => void;
  setGenerationMaxEndMinutes: (minutes: number) => void;
  /** Set which weekdays are avoided; reconciled into full-day blocked windows. */
  setAvoidedDays: (days: DayOfWeek[]) => void;
  setGenerationMinProfessorRating: (rating: number | null) => void;
  setIncludeClosedComponents: (value: boolean) => void;
  setVirtualSectionsOnly: (value: boolean) => void;
  generateSchedules: () => Promise<void>;
  clearSchedule: () => void;
  resetBasicCalendarSettings: () => void;
  /** Reset all schedule generation options to their defaults (keeps term/program/completed courses). */
  clearGenerationOptions: () => void;
  markBasicSettingsChanged: () => void;
  goToPreviousSeed: () => Promise<void>;
  goToNextSeed: () => Promise<void>;
  randomizeSeed: () => Promise<void>;
  swapCourseInSchedule: (
    enrollmentIndex: number,
    newCourseCode: NormalizedCourseCode,
  ) => Promise<void>;
  undoLastSwap: () => void;
  getSwapCandidates: (enrollmentIndex: number) => {
    candidates: NormalizedCourseCode[];
    poolCourses: NormalizedCourseCode[];
    requirementTitle?: string;
    rejectedWithConflict: Array<{
      code: NormalizedCourseCode;
      conflictsWith: NormalizedCourseCode;
    }>;
  };
  /** Pin the course like "Pick specific courses" for its pool (no immediate regeneration). */
  lockCourseForAllSchedulesFromSwap: (enrollmentIndex: number) => void;
  /** Remove calendar pin from basic required courses / constrain selections (no immediate regeneration). */
  unlockCourseForAllSchedulesFromSwap: (enrollmentIndex: number) => void;
  setLevelBuckets: (buckets: CourseLevelBucket[]) => void;
  setLanguageBuckets: (buckets: CourseLanguageBucket[]) => void;
  setElectiveLevelBuckets: (buckets: number[]) => void;
  setGenerationLimitFirstYearCredits: (v: boolean) => void;
  setGenerationCompressedSchedule: (v: boolean) => void;
  setGenerationPreferEasier: (v: boolean) => void;
  setGenerationPreferHigherSentiment: (v: boolean) => void;
  setCourseSentimentByNorm: (map: Map<NormalizedCourseCode, number> | null) => void;
  setFrenchImmersionStream: (enabled: boolean) => void;
  setBlacklistedCourses: (courses: string[]) => void;
  blacklistCourseFromSwap: (enrollmentIndex: number) => void;
  unblacklistCourseFromSwap: (enrollmentIndex: number) => void;
  /** Add a blocked window (merged with any it overlaps) and regenerate. */
  addBlockedTime: (window: Omit<BlockedTime, "id">) => void;
  /** Replace a blocked window's bounds (re-merging) and regenerate. */
  updateBlockedTime: (id: string, window: Omit<BlockedTime, "id">) => void;
  /** Remove a blocked window by id and regenerate. */
  removeBlockedTime: (id: string) => void;
  setCalendarWeekIndex: (index: number | null) => void;
  setCalendarMode: (mode: CalendarVariant | null) => void;
  clearEnrollmentsCache: () => void;
  importSchedule: (schedule: GeneratedSchedule) => void;
  resetToDefault: () => void;
}

export type AppStore = AppState & AppActions;
