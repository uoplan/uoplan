import type { Program } from "@uoplan/domain/dataTypes";
import type { CourseLanguageBucket, CourseLevelBucket } from "@uoplan/domain/courseFilters";
import type { SchoolId } from "@uoplan/domain/school";

import type { BlockedTimeWindow } from "./generation/types";
import type { OptimizationPriority } from "./optimizationPriorities";

/**
 * Planner state shape needed to reconstruct a schedule (subset of the
 * stateEncode {@code DecodedState}). Kept here so generation does not depend
 * on the state codec package.
 */
export interface DecodedState {
  school?: SchoolId;
  wizardMode: "basic" | "advanced" | null;
  basketCourses: string[];
  additionalElectivesCount: number;
  basicExcludedCategories: string[];
  selectedTermId: string | null;
  firstYear: number | null;
  program: Program | null;
  minorProgram: Program | null;
  completedCourseCodes: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  coursesThisSemester: number;
  firstSeed: number;
  currentSeed: number;
  swaps: Array<{ enrollmentIndex: number; courseCode: string }>;
  optionSelections: Array<{ reqIndex: number; optionIndex: number }>;
  courseSelections: Array<{ reqIndex: number; courseCodes: string[] }>;
  constrainedSelections: Array<{ reqIndex: number; courseCodes: string[] }>;
  constrainedGroupSelections: Array<{ reqIndex: number; groupPrefixes: string[] }>;
  requirementPrioritySelections: Array<{ reqIndex: number; priority: number }>;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  studentPrograms: string[];
  touchedReqIndices: number[];
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationLimitFirstYearCredits: boolean;
  optimizationPriorities: OptimizationPriority[];
  activeStep: number;
  showCalendar: boolean;
  frenchImmersionStream: boolean;
  calendarWeekIndex: number | null;
  blacklistedCourses: string[];
  blockedTimes: BlockedTimeWindow[];
}
