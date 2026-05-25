import type { Catalogue, Course, CourseGradesData, Program, SchedulesData } from "@uoplan/schedule";
import type {
  RemainingRequirement,
  RequirementWithStatus,
  CompletedRequirementItem,
} from "@uoplan/schedule";
import type { GeneratedSchedule } from "@uoplan/schedule";
import type { DayOfWeek } from "@uoplan/schedule";
import type { DataCache } from "@uoplan/schedule";
import type { CourseLanguageBucket, CourseLevelBucket } from "@uoplan/schedule";
import type { Indices } from "@uoplan/schedule";
import type { Term } from "@uoplan/schedule";
import type { ProfessorRatingsMap } from "@uoplan/schedule";
import type { Discipline } from "@uoplan/schedule";
import type { DecodedState } from "@uoplan/schedule";
import type { TimetableFailureDiagnostics } from "@uoplan/schedule";

export interface GenerationErrorDetails {
  emptyPools: Array<{ label: string; requirementId?: string; candidateCourses?: string[] }>;
  totalAvailable: number;
  totalNeeded: number;
  timetableFailure?: TimetableFailureDiagnostics;
  /** Human-readable descriptions of non-default filters that may be restricting results. */
  activeFilterHints?: string[];
}

/** Primary message plus optional structured context for the expandable Details panel. */
export type GenerationErrorState = {
  message: string;
  details: GenerationErrorDetails | null;
};

export interface AppState {
  basicPinnedCourses: string[];
  basicElectivesCount: number;
  basicExcludedCategories: string[];

  catalogue: Catalogue | null;
  indices: Indices | null;
  schedulesData: SchedulesData | null;
  cache: DataCache | null;
  courseGrades: CourseGradesData | null;
  courseGradesError: string | null;
  disciplines: Discipline[] | null;
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
  currentSwaps: Array<{ enrollmentIndex: number; courseCode: string }>;
  firstSeed: number;
  currentSeed: number;
  /** Earliest seed the user has generated at this session; drives Previous availability. */
  lowestVisitedSeed: number | null;
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationAllowedDays: DayOfWeek[];
  generationMinProfessorRating: number | null;
  professorRatings: ProfessorRatingsMap | null;
  includeClosedComponents: boolean;
  /** When true, only virtual meeting times are kept per section for scheduling. */
  virtualSectionsOnly: boolean;
  generationLimitFirstYearCredits: boolean;
  generationCompressedSchedule: boolean;
  /** Bias pool picks toward courses with higher historical grade averages. */
  generationPreferEasier: boolean;
  /** Highest wizard step index reached this session (sidebar progress). */
  wizardFurthestStep: number;
  frenchImmersionStream: boolean;
  /** The week group index the user last navigated to in the calendar, for URL sharing. */
  calendarWeekIndex: number | null;
  /** True when the last seed navigation returned the same course set as the current schedule. */
  scheduleNoVariety: boolean;
  /** Courses that must never appear in any generated schedule. */
  blacklistedCourses: string[];
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
  setSelectedTermId: (termId: string) => Promise<void>;
  setFirstYear: (year: number | null) => Promise<void>;
  loadEncodedState: (decoded: DecodedState) => void;
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
  setSelectedOptionForRequirement: (requirementId: string, optionIndex: number) => void;
  clearSelectedOptionForRequirement: (requirementId: string) => void;
  setCoursesThisSemester: (n: number) => void;
  setGenerationMinStartMinutes: (minutes: number) => void;
  setGenerationMaxEndMinutes: (minutes: number) => void;
  setGenerationAllowedDays: (days: DayOfWeek[]) => void;
  setGenerationMinProfessorRating: (rating: number | null) => void;
  setIncludeClosedComponents: (value: boolean) => void;
  setVirtualSectionsOnly: (value: boolean) => void;
  generateSchedules: () => Promise<void>;
  clearSchedule: () => void;
  resetBasicCalendarSettings: () => void;
  markBasicSettingsChanged: () => void;
  goToPreviousSeed: () => Promise<void>;
  goToNextSeed: () => Promise<void>;
  randomizeSeed: () => Promise<void>;
  swapCourseInSchedule: (enrollmentIndex: number, newCourseCode: string) => Promise<void>;
  undoLastSwap: () => void;
  getSwapCandidates: (enrollmentIndex: number) => {
    candidates: string[];
    poolCourses: string[];
    requirementTitle?: string;
    rejectedWithConflict: Array<{ code: string; conflictsWith: string }>;
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
  setFrenchImmersionStream: (enabled: boolean) => void;
  setBlacklistedCourses: (courses: string[]) => void;
  blacklistCourseFromSwap: (enrollmentIndex: number) => void;
  unblacklistCourseFromSwap: (enrollmentIndex: number) => void;
  setCalendarWeekIndex: (index: number | null) => void;
  importSchedule: (schedule: GeneratedSchedule) => void;
  resetToDefault: () => void;
  touchWizardFurthestStep: (step: number) => void;
  resetWizardFurthestStep: () => void;
}

export type AppStore = AppState & AppActions;
