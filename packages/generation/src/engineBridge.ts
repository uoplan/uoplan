/**
 * Bridge between the TypeScript app/worker and the Rust/WASM schedule engine
 * (`@uoplan/engine`). The engine owns all schedule *generation*; this module
 * only translates the existing TS inputs into the `engine.proto`
 * `GenerationRequest` shape and maps the `GenerationResponse` back into the
 * `GeneratedSchedule` types the UI/preview already understand.
 *
 * Nothing here runs generation logic itself — it is pure (de)serialization plus
 * a section-combo lookup against the `DataCache` to rebuild full enrollments
 * from the engine's compact `course -> {component: section}` choices.
 */
import {
  GenerationRequest,
  GenerationResponse,
  OptimizationKind as ProtoOptimizationKind,
  TimetableRequest,
} from "@uoplan/proto/engine";
import type {
  ComponentChoice,
  OptimizationPriority as ProtoOptimizationPriority,
  RemainingRequirement as ProtoRemainingRequirement,
  RequirementWithStatus as ProtoRequirementWithStatus,
  StringList,
} from "@uoplan/proto/engine";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { DEFAULT_SCHOOL_ID, SCHOOLS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";
import { courseAPlusPercent } from "@uoplan/grades/gradeDistribution";
import { getEnrollmentsForCourse } from "./generation/sectionCombos";
import type {
  CourseEnrollment,
  GeneratedSchedule,
  GenerationConstraints,
  SectionCombo,
} from "./generation/types";
import type {
  RemainingRequirement,
  RequirementWithStatus,
} from "@uoplan/requirements/requirements/types";
import { hasProfessorRatings } from "@uoplan/professors/professorRatings";
import { isOptimizationEnabled } from "./optimizationPriorities";
import type { OptimizationKind, OptimizationPriority } from "./optimizationPriorities";

const OPTIMIZATION_KIND_TO_PROTO: Record<OptimizationKind, ProtoOptimizationKind> = {
  free_days: ProtoOptimizationKind.OPTIMIZATION_KIND_FREE_DAYS,
  good_breaks: ProtoOptimizationKind.OPTIMIZATION_KIND_GOOD_BREAKS,
  prefer_easier: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_EASIER,
  prefer_sentiment: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_SENTIMENT,
  prefer_professor_rating: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_PROFESSOR_RATING,
};

/** Map the shared ordered priority list onto the engine's proto repeated field. */
function optimizationPrioritiesToProto(
  priorities: readonly OptimizationPriority[],
): ProtoOptimizationPriority[] {
  return priorities.map((p) => ({
    kind: OPTIMIZATION_KIND_TO_PROTO[p.kind],
    enabled: p.enabled,
    breakCount: p.breakCount ?? 0,
    breakTargetMinutes: p.breakTargetMinutes ?? 0,
  }));
}

/**
 * Minimal interface implemented by the WASM `Engine` (and any test double).
 * Both methods take a serialized request and return a serialized response.
 */
export interface ScheduleEngine {
  generate(request: Uint8Array): Uint8Array;
  timetable_fixed_set(request: Uint8Array): Uint8Array;
}

/** Shared selection/preference inputs common to basic and advanced requests. */
interface CommonRequestInput {
  school?: SchoolId;
  constraints: GenerationConstraints;
  completedCourses: string[];
  levelBuckets: string[];
  languageBuckets: string[];
  electiveLevelBuckets: number[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  /**
   * The ordered, individually-enabled optimization objectives (shared model).
   * Drives which soft objectives are active (prefer-easier/sentiment/professor
   * + the timetable-shape objectives) and their priority — replaces the old
   * per-preference booleans and the compressed-schedule flag.
   */
  optimizationPriorities: OptimizationPriority[];
  /**
   * Overall course-feedback sentiment (1-5) keyed by normalized course code,
   * supplied by the caller (built from the lazily-loaded feedback dataset). Only
   * consumed when the `prefer_sentiment` objective is enabled.
   */
  courseSentimentByNorm?: Map<NormalizedCourseCode, number> | null;
  blacklistedCourses: string[];
  currentSeed: number;
  firstSeed: number;
}

export interface BasicRequestInput extends CommonRequestInput {
  basketCourses: string[];
  additionalElectivesCount: number;
  coursesThisSemester: number;
  basicExcludedCategories: string[];
  studentPrograms: string[];
  frenchImmersionStream: boolean;
}

export interface AdvancedRequestInput extends CommonRequestInput {
  prereqEligibleCourses: string[];
  remainingRequirements: RemainingRequirement[];
  requirementTreeWithStatus: RequirementWithStatus[];
  constrainedPerRequirementRaw: Record<string, string[]>;
  selectedPerRequirement: Record<string, string[]>;
  selectedOptionsPerRequirement: Record<string, number>;
  coursesThisSemester: number;
  additionalElectivesCount: number;
  forcedCourses: string[];
  frenchImmersionStream: boolean;
  basicExcludedCategories: string[];
}

export interface TimetableFixedSetInput {
  courseCodes: string[];
  constraints: GenerationConstraints;
  seed: number;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  /** Courses exempt from the virtual-only filter (e.g. pinned courses keep all times). */
  virtualExemptCourses?: string[];
  applyBlacklist?: boolean;
  blacklistedCourses?: string[];
  /** Ordered optimization objectives — shape + professor objectives apply to swaps. */
  optimizationPriorities: OptimizationPriority[];
  /**
   * The school whose credit conventions apply. Determines `credit_config` forwarded to
   * the engine so the first-year credit cap uses the right per-course credit value.
   * Defaults to uOttawa when absent (preserves existing behaviour).
   */
  school?: SchoolId;
}

/** Mapped {@link GenerationResponse} in the shapes the app store consumes. */
export interface MappedGenerationResult {
  schedule: GeneratedSchedule | null;
  optionalPool: string[];
  pinned: string[];
  chosenCourseToRequirementId: Record<string, string>;
  poolDiagnostics: {
    emptyPools: { label: string; requirementId?: string; candidateCourses: string[] }[];
    totalAvailable: number;
    totalNeeded: number;
  } | null;
  error: string | null;
}

const DAY_CODE_TO_INDEX: Record<string, number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

function constraintsToProto(c: GenerationConstraints): GenerationRequest["constraints"] {
  return {
    minStartMinutes: c.minStartMinutes,
    maxEndMinutes: c.maxEndMinutes,
    maxFirstYearCredits: c.maxFirstYearCredits,
    blockedTimes: (c.blockedTimes ?? []).map((b) => ({
      day: DAY_CODE_TO_INDEX[b.day] ?? 0,
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
    })),
  };
}

/**
 * Flatten the {@link ProfessorRatingsMap} into the engine's
 * `map<string, double>` shape (normalized professor name -> rating). Only
 * genuinely rated professors are forwarded — unrated entries (`rating: 0,
 * numRatings: 0`) are omitted so the engine treats them as "no rating" and
 * applies the unrated default (~4.0) when weighting (see
 * `weights.rs::professor_rating_weight`).
 */
function professorRatingsToProto(c: GenerationConstraints): Record<string, number> {
  const out: Record<string, number> = {};
  const ratings = c.professorRatings;
  if (!ratings) return out;
  for (const [name, entry] of Object.entries(ratings)) {
    if (hasProfessorRatings(entry)) out[name] = entry.rating;
  }
  return out;
}

/** Course code -> A+ percentage (0–100) for the "prefer easier" soft weighting. */
function buildCourseAplusMap(cache: DataCache): Record<string, number> {
  const out: Record<string, number> = {};
  for (const schedule of cache.getAllSchedules()) {
    const pct = courseAPlusPercent(schedule);
    if (pct != null && Number.isFinite(pct)) out[schedule.courseCode] = pct;
  }
  return out;
}

/**
 * Course code -> overall feedback sentiment (1-5) for the "prefer higher
 * sentiment" soft weighting. Keyed by the schedule's raw course code (matching
 * {@link buildCourseAplusMap}) so the engine's per-course lookups line up; values
 * come from the caller's normalized-code sentiment map.
 */
function buildCourseSentimentMap(
  cache: DataCache,
  byNorm: Map<NormalizedCourseCode, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const schedule of cache.getAllSchedules()) {
    const s = byNorm.get(schedule.courseCode);
    if (s != null && Number.isFinite(s)) out[schedule.courseCode] = s;
  }
  return out;
}

function stringListMap(rec: Record<string, string[]>): Record<string, StringList> {
  const out: Record<string, StringList> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = { values: v };
  return out;
}

function remainingToProto(reqs: RemainingRequirement[]): ProtoRemainingRequirement[] {
  return reqs.map((r) => ({
    requirementId: r.requirementId,
    type: r.type,
    title: r.title,
    candidateCourses: r.candidateCourses,
    creditsNeeded: r.creditsNeeded,
    pickedCount: r.pickedCount,
    satisfiedBy: r.satisfiedBy,
  }));
}

function requirementTreeToProto(nodes: RequirementWithStatus[]): ProtoRequirementWithStatus[] {
  return nodes.map((n) => ({
    type: n.type,
    title: n.title,
    code: n.code,
    credits: n.credits,
    disciplineLevels: (n.disciplineLevels ?? []).map((d) => ({
      discipline: d.discipline,
      levels: d.levels ?? [],
    })),
    excludedDisciplines: n.excluded_disciplines ?? [],
    faculty: n.faculty,
    options: requirementTreeToProto(n.options ?? []),
    complete: n.complete,
    satisfiedBy: n.satisfiedBy,
    satisfiedOptionIndex: n.satisfiedOptionIndex,
    requirementId: n.requirementId,
    candidateCourses: n.candidateCourses ?? [],
    creditsNeeded: n.creditsNeeded,
    pickedCount: n.pickedCount,
  }));
}

type CommonGenerationRequestFields = Pick<
  GenerationRequest,
  | "basicExcludedCategories"
  | "completedCourses"
  | "levelBuckets"
  | "languageBuckets"
  | "electiveLevelBuckets"
  | "includeClosedComponents"
  | "virtualSectionsOnly"
  | "frenchImmersionStream"
  | "blacklistedCourses"
  | "constraints"
  | "currentSeed"
  | "firstSeed"
  | "professorRatings"
  | "courseAplus"
  | "courseSentiment"
  | "optimizationPriorities"
  | "creditConfig"
>;

type SharedGenerationRequestFields = Omit<
  CommonGenerationRequestFields,
  "basicExcludedCategories" | "completedCourses"
>;

type InputWithCommonGenerationFields = CommonRequestInput &
  Pick<BasicRequestInput, "basicExcludedCategories" | "frenchImmersionStream">;

function buildCommonGenerationRequestFields(
  input: InputWithCommonGenerationFields,
  cache: DataCache,
): CommonGenerationRequestFields {
  const preferEasier = isOptimizationEnabled(input.optimizationPriorities, "prefer_easier");
  const preferSentiment = isOptimizationEnabled(input.optimizationPriorities, "prefer_sentiment");
  const preferProfessorRating = isOptimizationEnabled(
    input.optimizationPriorities,
    "prefer_professor_rating",
  );
  const creditConfig = SCHOOLS[input.school ?? DEFAULT_SCHOOL_ID].credits;
  return {
    basicExcludedCategories: input.basicExcludedCategories,
    completedCourses: input.completedCourses,
    levelBuckets: input.levelBuckets,
    languageBuckets: input.languageBuckets,
    electiveLevelBuckets: input.electiveLevelBuckets,
    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,
    frenchImmersionStream: input.frenchImmersionStream,
    blacklistedCourses: input.blacklistedCourses,
    constraints: constraintsToProto(input.constraints),
    currentSeed: input.currentSeed,
    firstSeed: input.firstSeed,
    professorRatings: preferProfessorRating ? professorRatingsToProto(input.constraints) : {},
    courseAplus: preferEasier ? buildCourseAplusMap(cache) : {},
    courseSentiment:
      preferSentiment && input.courseSentimentByNorm
        ? buildCourseSentimentMap(cache, input.courseSentimentByNorm)
        : {},
    optimizationPriorities: optimizationPrioritiesToProto(input.optimizationPriorities),
    creditConfig: {
      typicalCourseCredits: creditConfig.typicalCourseCredits,
      defaultCourseCredits: creditConfig.defaultCourseCredits,
    },
  };
}

function buildSharedGenerationRequestFields(
  common: CommonGenerationRequestFields,
): SharedGenerationRequestFields {
  return {
    levelBuckets: common.levelBuckets,
    languageBuckets: common.languageBuckets,
    electiveLevelBuckets: common.electiveLevelBuckets,
    includeClosedComponents: common.includeClosedComponents,
    virtualSectionsOnly: common.virtualSectionsOnly,
    frenchImmersionStream: common.frenchImmersionStream,
    blacklistedCourses: common.blacklistedCourses,
    constraints: common.constraints,
    currentSeed: common.currentSeed,
    firstSeed: common.firstSeed,
    professorRatings: common.professorRatings,
    courseAplus: common.courseAplus,
    courseSentiment: common.courseSentiment,
    optimizationPriorities: common.optimizationPriorities,
    creditConfig: common.creditConfig,
  };
}

export function buildBasicRequest(input: BasicRequestInput, cache: DataCache): GenerationRequest {
  const common = buildCommonGenerationRequestFields(input, cache);
  return {
    basicPinnedCourses: input.basketCourses,
    additionalElectivesCount: input.additionalElectivesCount,
    basicExcludedCategories: common.basicExcludedCategories,
    completedCourses: common.completedCourses,
    studentPrograms: input.studentPrograms,
    remainingRequirements: [],
    requirementTree: [],
    selectedPerRequirement: {},
    selectedOptionsPerRequirement: {},
    constrainedPerRequirement: {},
    requirementPriorities: {},
    coursesThisSemester: input.coursesThisSemester,
    prereqEligibleCourses: [],
    forcedCourses: [],
    ...buildSharedGenerationRequestFields(common),
  };
}

export function buildAdvancedRequest(
  input: AdvancedRequestInput,
  cache: DataCache,
): GenerationRequest {
  const common = buildCommonGenerationRequestFields(input, cache);
  return {
    basicPinnedCourses: [],
    additionalElectivesCount: input.additionalElectivesCount,
    basicExcludedCategories: common.basicExcludedCategories,
    completedCourses: common.completedCourses,
    studentPrograms: [],
    remainingRequirements: remainingToProto(input.remainingRequirements),
    requirementTree: requirementTreeToProto(input.requirementTreeWithStatus),
    selectedPerRequirement: stringListMap(input.selectedPerRequirement),
    selectedOptionsPerRequirement: input.selectedOptionsPerRequirement,
    constrainedPerRequirement: stringListMap(input.constrainedPerRequirementRaw),
    requirementPriorities: {},
    coursesThisSemester: input.coursesThisSemester,
    prereqEligibleCourses: input.prereqEligibleCourses,
    forcedCourses: input.forcedCourses,
    ...buildSharedGenerationRequestFields(common),
  };
}

function chosenToEnrollment(
  courseCode: string,
  components: ComponentChoice[],
  cache: DataCache,
): CourseEnrollment | null {
  if (components.length === 0) {
    // Honours project / timeless course: empty section combo, no meeting times.
    return { courseCode: cache.resolveToCanonical(courseCode), sectionCombo: {}, times: [] };
  }
  const schedule = cache.getSchedule(courseCode);
  if (!schedule) return null;
  const combo: SectionCombo = {};
  for (const { component, section } of components) {
    const sections = schedule.components[component] ?? [];
    const match = sections.find((s) => s.section === section);
    if (!match) return null;
    combo[component] = { section: match };
  }
  return getEnrollmentsForCourse(schedule, combo);
}

export function mapGenerationResponse(
  response: GenerationResponse,
  cache: DataCache,
): MappedGenerationResult {
  let schedule: GeneratedSchedule | null = null;
  if (response.hasSchedule) {
    const enrollments: CourseEnrollment[] = [];
    let ok = true;
    for (const course of response.courses) {
      const enrollment = chosenToEnrollment(course.courseCode, course.components, cache);
      if (!enrollment) {
        ok = false;
        break;
      }
      enrollments.push(enrollment);
    }
    schedule = ok ? { enrollments } : null;
  }

  return {
    schedule,
    optionalPool: response.optionalPool,
    pinned: response.pinned,
    chosenCourseToRequirementId: response.chosenCourseToRequirement,
    poolDiagnostics: response.poolDiagnostics
      ? {
          emptyPools: response.poolDiagnostics.emptyPools.map((p) => ({
            label: p.label,
            requirementId: p.requirementId,
            candidateCourses: p.candidateCourses,
          })),
          totalAvailable: response.poolDiagnostics.totalAvailable,
          totalNeeded: response.poolDiagnostics.totalNeeded,
        }
      : null,
    error: response.error ?? null,
  };
}

/** Map a fixed-set timetable {@link GenerationResponse} to a schedule (or null). */
function mapTimetableResponse(
  response: GenerationResponse,
  cache: DataCache,
): GeneratedSchedule | null {
  return mapGenerationResponse(response, cache).schedule;
}

function buildTimetableRequest(input: TimetableFixedSetInput): TimetableRequest {
  const preferProfessorRating = isOptimizationEnabled(
    input.optimizationPriorities,
    "prefer_professor_rating",
  );
  const creditConfig = SCHOOLS[input.school ?? DEFAULT_SCHOOL_ID].credits;
  return {
    courseCodes: input.courseCodes,
    constraints: constraintsToProto(input.constraints),
    seed: input.seed >>> 0,
    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,
    virtualExemptCourses: input.virtualExemptCourses ?? [],
    professorRatings: preferProfessorRating ? professorRatingsToProto(input.constraints) : {},
    applyBlacklist: input.applyBlacklist ?? false,
    blacklistedCourses: input.blacklistedCourses ?? [],
    optimizationPriorities: optimizationPrioritiesToProto(input.optimizationPriorities),
    creditConfig: {
      typicalCourseCredits: creditConfig.typicalCourseCredits,
      defaultCourseCredits: creditConfig.defaultCourseCredits,
    },
  };
}

/** Run a basic generation against the engine and map the response. */
export function runBasicGeneration(
  engine: ScheduleEngine,
  input: BasicRequestInput,
  cache: DataCache,
): MappedGenerationResult {
  const request = buildBasicRequest(input, cache);
  const bytes = GenerationRequest.encode(request).finish();
  const responseBytes = engine.generate(bytes);
  const response = GenerationResponse.decode(responseBytes);
  return mapGenerationResponse(response, cache);
}

/** Run an advanced generation against the engine and map the response. */
export function runAdvancedGeneration(
  engine: ScheduleEngine,
  input: AdvancedRequestInput,
  cache: DataCache,
): MappedGenerationResult {
  const request = buildAdvancedRequest(input, cache);
  const bytes = GenerationRequest.encode(request).finish();
  const responseBytes = engine.generate(bytes);
  const response = GenerationResponse.decode(responseBytes);
  return mapGenerationResponse(response, cache);
}

/** Re-timetable a fixed course set via the engine, returning a schedule or null. */
export function runTimetableFixedSet(
  engine: ScheduleEngine,
  input: TimetableFixedSetInput,
  cache: DataCache,
): GeneratedSchedule | null {
  const request = buildTimetableRequest(input);
  const bytes = TimetableRequest.encode(request).finish();
  const responseBytes = engine.timetable_fixed_set(bytes);
  const response = GenerationResponse.decode(responseBytes);
  return mapTimetableResponse(response, cache);
}
