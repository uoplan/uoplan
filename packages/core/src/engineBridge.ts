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
  type ComponentChoice,
  type RemainingRequirement as ProtoRemainingRequirement,
  type RequirementWithStatus as ProtoRequirementWithStatus,
  type StringList,
  GenerationRequest,
  GenerationResponse,
  TimetableRequest,
  Mode,
} from "@uoplan/proto/engine";
import type { DataCache } from "./dataCache";
import type { NormalizedCourseCode } from "./brand";
import { courseAPlusPercent } from "./gradeDistribution";
import { getEnrollmentsForCourse } from "./generation/sectionCombos";
import type {
  CourseEnrollment,
  GeneratedSchedule,
  GenerationConstraints,
  SectionCombo,
} from "./generation/types";
import type { RemainingRequirement, RequirementWithStatus } from "./requirements/types";

export { Mode as EngineMode };

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
  constraints: GenerationConstraints;
  completedCourses: string[];
  levelBuckets: string[];
  languageBuckets: string[];
  electiveLevelBuckets: number[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  generationPreferEasier: boolean;
  /** Soft "prefer higher sentiment" (course-feedback overall rating) preference. */
  generationPreferHigherSentiment: boolean;
  /**
   * Overall course-feedback sentiment (1-5) keyed by normalized course code,
   * supplied by the caller (built from the lazily-loaded feedback dataset). Only
   * consumed when {@link generationPreferHigherSentiment} is true.
   */
  courseSentimentByNorm?: Map<NormalizedCourseCode, number> | null;
  blacklistedCourses: string[];
  currentSeed: number;
  firstSeed: number;
}

export interface BasicRequestInput extends CommonRequestInput {
  basicPinnedCourses: string[];
  basicElectivesCount: number;
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
    minProfessorRating: c.minProfessorRating,
    maxFirstYearCredits: c.maxFirstYearCredits,
    compressedSchedule: c.compressedSchedule ?? false,
    blockedTimes: (c.blockedTimes ?? []).map((b) => ({
      day: DAY_CODE_TO_INDEX[b.day] ?? 0,
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
    })),
  };
}

function professorRatingsToProto(c: GenerationConstraints): Record<string, number> {
  const out: Record<string, number> = {};
  const ratings = c.professorRatings;
  if (!ratings) return out;
  for (const [name, rating] of Object.entries(ratings)) {
    if (typeof rating === "number" && Number.isFinite(rating)) out[name] = rating;
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
  | "generationPreferEasier"
  | "frenchImmersionStream"
  | "blacklistedCourses"
  | "constraints"
  | "currentSeed"
  | "firstSeed"
  | "professorRatings"
  | "courseAplus"
  | "generationPreferHigherSentiment"
  | "courseSentiment"
>;

type InputWithCommonGenerationFields = CommonRequestInput &
  Pick<BasicRequestInput, "basicExcludedCategories" | "frenchImmersionStream">;

function buildCommonGenerationRequestFields(
  input: InputWithCommonGenerationFields,
  cache: DataCache,
): CommonGenerationRequestFields {
  return {
    basicExcludedCategories: input.basicExcludedCategories,
    completedCourses: input.completedCourses,
    levelBuckets: input.levelBuckets,
    languageBuckets: input.languageBuckets,
    electiveLevelBuckets: input.electiveLevelBuckets,
    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,
    generationPreferEasier: input.generationPreferEasier,
    frenchImmersionStream: input.frenchImmersionStream,
    blacklistedCourses: input.blacklistedCourses,
    constraints: constraintsToProto(input.constraints),
    currentSeed: input.currentSeed,
    firstSeed: input.firstSeed,
    professorRatings: professorRatingsToProto(input.constraints),
    courseAplus: input.generationPreferEasier ? buildCourseAplusMap(cache) : {},
    generationPreferHigherSentiment: input.generationPreferHigherSentiment,
    courseSentiment:
      input.generationPreferHigherSentiment && input.courseSentimentByNorm
        ? buildCourseSentimentMap(cache, input.courseSentimentByNorm)
        : {},
  };
}

export function buildBasicRequest(input: BasicRequestInput, cache: DataCache): GenerationRequest {
  const common = buildCommonGenerationRequestFields(input, cache);
  return {
    mode: Mode.MODE_BASIC,
    basicPinnedCourses: input.basicPinnedCourses,
    basicElectivesCount: input.basicElectivesCount,
    basicExcludedCategories: common.basicExcludedCategories,
    completedCourses: common.completedCourses,
    studentPrograms: input.studentPrograms,
    remainingRequirements: [],
    requirementTree: [],
    selectedPerRequirement: {},
    selectedOptionsPerRequirement: {},
    constrainedPerRequirement: {},
    requirementPriorities: {},
    coursesThisSemester: 0,
    prereqEligibleCourses: [],
    forcedCourses: [],
    levelBuckets: common.levelBuckets,
    languageBuckets: common.languageBuckets,
    electiveLevelBuckets: common.electiveLevelBuckets,
    includeClosedComponents: common.includeClosedComponents,
    virtualSectionsOnly: common.virtualSectionsOnly,
    generationPreferEasier: common.generationPreferEasier,
    frenchImmersionStream: common.frenchImmersionStream,
    blacklistedCourses: common.blacklistedCourses,
    constraints: common.constraints,
    currentSeed: common.currentSeed,
    firstSeed: common.firstSeed,
    professorRatings: common.professorRatings,
    courseAplus: common.courseAplus,
    generationPreferHigherSentiment: common.generationPreferHigherSentiment,
    courseSentiment: common.courseSentiment,
  };
}

export function buildAdvancedRequest(
  input: AdvancedRequestInput,
  cache: DataCache,
): GenerationRequest {
  const common = buildCommonGenerationRequestFields(input, cache);
  return {
    mode: Mode.MODE_ADVANCED,
    basicPinnedCourses: [],
    basicElectivesCount: 0,
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
    levelBuckets: common.levelBuckets,
    languageBuckets: common.languageBuckets,
    electiveLevelBuckets: common.electiveLevelBuckets,
    includeClosedComponents: common.includeClosedComponents,
    virtualSectionsOnly: common.virtualSectionsOnly,
    generationPreferEasier: common.generationPreferEasier,
    frenchImmersionStream: common.frenchImmersionStream,
    blacklistedCourses: common.blacklistedCourses,
    constraints: common.constraints,
    currentSeed: common.currentSeed,
    firstSeed: common.firstSeed,
    professorRatings: common.professorRatings,
    courseAplus: common.courseAplus,
    generationPreferHigherSentiment: common.generationPreferHigherSentiment,
    courseSentiment: common.courseSentiment,
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
  return {
    courseCodes: input.courseCodes,
    constraints: constraintsToProto(input.constraints),
    seed: input.seed >>> 0,
    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,
    virtualExemptCourses: input.virtualExemptCourses ?? [],
    professorRatings: professorRatingsToProto(input.constraints),
    applyBlacklist: input.applyBlacklist ?? false,
    blacklistedCourses: input.blacklistedCourses ?? [],
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
