import { deflateSync, inflateSync } from "fflate";
import type { Indices, Program, DayOfWeek as SchemaDayOfWeek } from "./dataTypes";
import { DAY_OF_WEEK_CODES } from "./dataTypes";
import type { CourseLanguageBucket, CourseLevelBucket } from "./courseFilters";
import type { RemainingRequirement, RequirementWithStatus } from "./requirements";
import type { BlockedTimeWindow } from "./generation";
import { getCourseLevel, isOptCourse } from "./utils/courseUtils";
import { groupTokenPrefix, isGroupToken } from "./utils/groupToken";
import type {
  DayOfWeek as ProtoDayOfWeek,
  OptimizationPriority as ProtoOptimizationPriority,
} from "@uoplan/proto/state";
import {
  CourseLanguageBucket as ProtoLang,
  CourseLevelBucket as ProtoLevel,
  OptimizationKind as ProtoOptimizationKind,
  ShareableState,
  WizardMode,
} from "@uoplan/proto/state";
import { hasBreakParams, normalizeOptimizationPriorities } from "./optimizationPriorities";
import type { OptimizationKind, OptimizationPriority } from "./optimizationPriorities";

const OPTIMIZATION_KIND_TO_STATE_PROTO: Record<OptimizationKind, ProtoOptimizationKind> = {
  free_days: ProtoOptimizationKind.OPTIMIZATION_KIND_FREE_DAYS,
  good_breaks: ProtoOptimizationKind.OPTIMIZATION_KIND_GOOD_BREAKS,
  prefer_easier: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_EASIER,
  prefer_sentiment: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_SENTIMENT,
  prefer_professor_rating: ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_PROFESSOR_RATING,
};

const STATE_PROTO_TO_OPTIMIZATION_KIND: Partial<Record<ProtoOptimizationKind, OptimizationKind>> = {
  [ProtoOptimizationKind.OPTIMIZATION_KIND_FREE_DAYS]: "free_days",
  [ProtoOptimizationKind.OPTIMIZATION_KIND_GOOD_BREAKS]: "good_breaks",
  [ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_EASIER]: "prefer_easier",
  [ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_SENTIMENT]: "prefer_sentiment",
  [ProtoOptimizationKind.OPTIMIZATION_KIND_PREFER_PROFESSOR_RATING]: "prefer_professor_rating",
};

function optimizationPriorityToStateProto(p: OptimizationPriority): ProtoOptimizationPriority {
  return {
    kind: OPTIMIZATION_KIND_TO_STATE_PROTO[p.kind],
    enabled: p.enabled,
    breakCount: hasBreakParams(p.kind) ? (p.breakCount ?? 0) : 0,
    breakTargetMinutes: hasBreakParams(p.kind) ? (p.breakTargetMinutes ?? 0) : 0,
  };
}

function optimizationPrioritiesFromStateProto(
  raw: ProtoOptimizationPriority[] | undefined,
): OptimizationPriority[] {
  const mapped: OptimizationPriority[] = [];
  for (const p of raw ?? []) {
    const kind = STATE_PROTO_TO_OPTIMIZATION_KIND[p.kind as ProtoOptimizationKind];
    if (!kind) continue;
    mapped.push({
      kind,
      enabled: p.enabled,
      breakCount: p.breakCount,
      breakTargetMinutes: p.breakTargetMinutes || undefined,
    });
  }
  return normalizeOptimizationPriorities(mapped);
}

export function requirementIdsFromTree(nodes: RequirementWithStatus[]): string[] {
  const out: string[] = [];
  function walk(n: RequirementWithStatus[]) {
    for (const node of n) {
      if (node.requirementId) out.push(node.requirementId);
      if (node.options?.length) walk(node.options);
    }
  }
  walk(nodes);
  return out;
}

export function urlToSlug(url: string): string {
  return url
    .replace(/^https?:\/\/catalogue\.uottawa\.ca(?:\/archive\/\d{4}-\d{4})?\/en\//, "")
    .replace(/\/$/, "");
}

export const STATE_MAGIC = 0x554f504e; // "UOPN" — bumped from "UOPM" (0x554f504d) when the hard min-professor-rating field was removed in favour of the soft prefer-higher-professor-rating preference

function programSlug(p: Program): string {
  return (p as Program & { slug?: string }).slug ?? urlToSlug(p.url);
}

const OPT_SENTINEL_BASE = 0xfffffff0; // Safely inside uint32 space

export interface EncodeInput {
  wizardMode: "basic" | "advanced" | null;
  basketCourses: string[];
  basicElectivesCount: number;
  basicExcludedCategories: string[];

  selectedTermId: string | null;
  firstYear: number | null;
  program: Program | null;
  minorProgram: Program | null;
  completedCourses: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  coursesThisSemester: number;
  firstSeed: number;
  currentSeed: number;
  swaps: Array<{ enrollmentIndex: number; courseCode: string }>;
  selectedPerRequirement: Record<string, string[]>;
  selectedOptionsPerRequirement: Record<string, number>;
  constrainedPerRequirement: Record<string, string[]>;
  requirementPriorities: Record<string, number>;
  requirementTreeWithStatus: RequirementWithStatus[];
  remainingRequirements: RemainingRequirement[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  studentPrograms: string[];

  requirementSlotsUserTouched: Record<string, true>;
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationLimitFirstYearCredits: boolean;
  optimizationPriorities: OptimizationPriority[];
  activeStep: number;
  showCalendar: boolean;
  frenchImmersionStream: boolean;
  calendarWeekIndex?: number | null;
  blacklistedCourses: string[];
  blockedTimes: BlockedTimeWindow[];
}

export interface DecodedState {
  wizardMode: "basic" | "advanced" | null;
  basketCourses: string[];
  basicElectivesCount: number;
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

export interface CatalogueLike {
  courses: Array<{ code: string }>;
  programs: Program[];
}

// Helpers for mappings
function levelToProto(b: CourseLevelBucket): ProtoLevel {
  return b === "undergrad" ? ProtoLevel.COURSE_LEVEL_UNDERGRAD : ProtoLevel.COURSE_LEVEL_GRAD;
}

function protoToLevel(b: ProtoLevel): CourseLevelBucket {
  return b === ProtoLevel.COURSE_LEVEL_UNDERGRAD ? "undergrad" : "grad";
}

function langToProto(b: CourseLanguageBucket): ProtoLang {
  if (b === "en") return ProtoLang.COURSE_LANGUAGE_EN;
  if (b === "fr") return ProtoLang.COURSE_LANGUAGE_FR;
  return ProtoLang.COURSE_LANGUAGE_OTHER;
}

function protoToLang(b: ProtoLang): CourseLanguageBucket {
  if (b === ProtoLang.COURSE_LANGUAGE_EN) return "en";
  if (b === ProtoLang.COURSE_LANGUAGE_FR) return "fr";
  return "other";
}

function dayToProto(d: SchemaDayOfWeek): ProtoDayOfWeek {
  // state.proto DayOfWeek is 0-indexed by canonical day order (Mo = 0).
  return DAY_OF_WEEK_CODES.indexOf(d) as ProtoDayOfWeek;
}

function protoToDay(p: ProtoDayOfWeek): SchemaDayOfWeek {
  return DAY_OF_WEEK_CODES[p as number] ?? "Mo";
}

export function encodeState(
  input: EncodeInput,
  _catalogue: CatalogueLike,
  indices: Indices,
): Uint8Array | null {
  const programIndex =
    input.program != null ? indices.programs.indexOf(programSlug(input.program)) : -1;
  if (input.program != null && programIndex < 0) return null;

  const minorProgramIndex =
    input.minorProgram != null ? indices.programs.indexOf(programSlug(input.minorProgram)) : -1;
  if (input.minorProgram != null && minorProgramIndex < 0) return null;

  const courseCodeToIndex = new Map<string, number>();
  for (const [i, code] of indices.courses.entries()) courseCodeToIndex.set(code, i);

  const disciplineToIndex = new Map<string, number>();
  for (const [i, code] of indices.disciplines.entries()) disciplineToIndex.set(code, i);

  const encodeDiscipline = (code: string): number | undefined =>
    disciplineToIndex.get(code.toUpperCase());

  // Validate courses
  for (const code of input.completedCourses) {
    if (!isOptCourse(code) && !courseCodeToIndex.has(code)) return null;
  }
  for (const code of input.basketCourses) {
    if (!courseCodeToIndex.has(code)) return null;
  }
  for (const code of input.blacklistedCourses) {
    if (!courseCodeToIndex.has(code)) return null;
  }

  const encodeCourseCode = (c: string): number | undefined => {
    if (isOptCourse(c)) return OPT_SENTINEL_BASE + Math.floor((getCourseLevel(c) ?? 1000) / 1000);
    return courseCodeToIndex.get(c);
  };

  const orderedReqIds = requirementIdsFromTree(input.requirementTreeWithStatus);
  const reqIdToIndex = new Map<string, number>();
  for (const [i, id] of orderedReqIds.entries()) reqIdToIndex.set(id, i);

  // Assemble State
  const state: ShareableState = {
    wizardMode:
      input.wizardMode === "basic"
        ? WizardMode.WIZARD_MODE_BASIC
        : input.wizardMode === "advanced"
          ? WizardMode.WIZARD_MODE_ADVANCED
          : WizardMode.WIZARD_MODE_UNSPECIFIED,
    basicPinnedCourses: input.basketCourses
      .map(encodeCourseCode)
      .filter((i): i is number => i !== undefined),
    basicElectivesCount: input.basicElectivesCount,
    basicExcludedCategoryIndices: input.basicExcludedCategories
      .map(encodeDiscipline)
      .filter((i): i is number => i !== undefined),

    selectedTermId: input.selectedTermId != null ? parseInt(input.selectedTermId, 10) : undefined,
    firstYear: input.firstYear ?? undefined,
    programIndex: programIndex !== -1 ? programIndex : undefined,
    minorProgramIndex: minorProgramIndex !== -1 ? minorProgramIndex : undefined,
    studentProgramIndices: input.studentPrograms
      .map(encodeDiscipline)
      .filter((i): i is number => i !== undefined),

    completedCourses: input.completedCourses
      .map(encodeCourseCode)
      .filter((i): i is number => i !== undefined),
    levelBuckets: input.levelBuckets.map(levelToProto),
    languageBuckets: input.languageBuckets.map(langToProto),
    electiveLevelBuckets: input.electiveLevelBuckets,

    coursesThisSemester: input.coursesThisSemester,
    firstSeed: input.firstSeed,
    currentSeed: input.currentSeed,
    swaps: input.swaps.map((s) => ({
      enrollmentIndex: s.enrollmentIndex,
      courseCodeIndex: courseCodeToIndex.get(s.courseCode) ?? 0,
    })),

    optionSelections: [],
    courseSelections: [],
    constrainedSelections: [],
    constrainedGroupSelections: [],
    requirementPriorities: [],
    touchedReqIndices: [],

    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,

    generationMinStartMinutes: input.generationMinStartMinutes,
    generationMaxEndMinutes: input.generationMaxEndMinutes,
    generationAllowedDays: [],
    generationLimitFirstYearCredits: input.generationLimitFirstYearCredits,
    optimizationPriorities: input.optimizationPriorities.map(optimizationPriorityToStateProto),
    frenchImmersionStream: input.frenchImmersionStream,
    magic: STATE_MAGIC,
    activeStep: input.activeStep,
    showCalendar: input.showCalendar,
    calendarWeekIndex: input.calendarWeekIndex != null ? input.calendarWeekIndex : undefined,
    blacklistedCourses: input.blacklistedCourses
      .map(encodeCourseCode)
      .filter((i): i is number => i !== undefined),
    blockedTimes: input.blockedTimes.map((b) => ({
      day: dayToProto(b.day),
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
    })),
  };

  // Requirements
  for (const [reqId, optionIndex] of Object.entries(input.selectedOptionsPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) {
      state.optionSelections.push({ reqIndex, optionIndex });
    }
  }

  for (const [reqId, codes] of Object.entries(input.selectedPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) {
      const courseIndices = codes.map(encodeCourseCode).filter((i): i is number => i !== undefined);
      if (courseIndices.length > 0) state.courseSelections.push({ reqIndex, courseIndices });
    }
  }

  for (const [reqId, codes] of Object.entries(input.constrainedPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) {
      const realCodes: string[] = [];
      const groupPrefixes: string[] = [];
      for (const c of codes) {
        if (isGroupToken(c)) {
          groupPrefixes.push(groupTokenPrefix(c));
        } else {
          realCodes.push(c);
        }
      }
      if (realCodes.length > 0) {
        const courseIndices = realCodes
          .map(encodeCourseCode)
          .filter((i): i is number => i !== undefined);
        if (courseIndices.length > 0) state.constrainedSelections.push({ reqIndex, courseIndices });
      }
      if (groupPrefixes.length > 0) {
        const groupPrefixIndices = groupPrefixes
          .map(encodeDiscipline)
          .filter((i): i is number => i !== undefined);
        if (groupPrefixIndices.length > 0)
          state.constrainedGroupSelections.push({ reqIndex, groupPrefixIndices });
      }
    }
  }

  for (const reqId of Object.keys(input.requirementSlotsUserTouched)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) state.touchedReqIndices.push(reqIndex);
  }

  for (const [reqId, priority] of Object.entries(input.requirementPriorities)) {
    if (priority <= 0) continue;
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) state.requirementPriorities.push({ reqIndex, priority });
  }

  try {
    return ShareableState.encode(state).finish();
  } catch {
    return null;
  }
}

export type DecodeError = { error: string };

export function peekTermAndYear(
  bytes: Uint8Array,
): { termId: string | null; firstYear: number | null } | null {
  try {
    const state = ShareableState.decode(bytes);
    if (state.magic !== STATE_MAGIC) return null;
    return {
      termId: state.selectedTermId != null ? String(state.selectedTermId) : null,
      firstYear: state.firstYear ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Whether the persisted state shows the user has personalized at all: a program
 * is selected, completed courses were entered, or the basket is non-empty. Reads
 * only proto fields, so it works WITHOUT the catalogue/indices needed to fully
 * resolve the state (e.g. on the landing page, before app data loads).
 */
export function peekHasPersonalized(bytes: Uint8Array): boolean {
  try {
    const state = ShareableState.decode(bytes);
    if (state.magic !== STATE_MAGIC) return false;
    return (
      state.programIndex !== undefined ||
      state.completedCourses.length > 0 ||
      state.basicPinnedCourses.length > 0
    );
  } catch {
    return false;
  }
}

export function decodeState(
  buffer: Uint8Array,
  catalogue: CatalogueLike,
  indices: Indices,
): DecodedState | DecodeError {
  let state: ShareableState;
  try {
    state = ShareableState.decode(buffer);
  } catch {
    return { error: "Invalid state encoding" };
  }

  if (state.magic !== STATE_MAGIC) {
    return { error: "Incompatible or corrupted state data" };
  }

  let program: Program | null = null;
  if (state.programIndex !== undefined && state.programIndex < indices.programs.length) {
    const slug = indices.programs[state.programIndex];
    program = catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
    if (program === null)
      return { error: "Program from shared state is no longer in the catalogue" };
  }

  let minorProgram: Program | null = null;
  if (state.minorProgramIndex !== undefined && state.minorProgramIndex < indices.programs.length) {
    const slug = indices.programs[state.minorProgramIndex];
    minorProgram = catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
    if (minorProgram === null)
      return { error: "Minor program from shared state is no longer in the catalogue" };
  }

  const decodeCourseIndices = (
    indicesList: number[],
    optCounters?: Map<number, number>,
  ): string[] => {
    const codes: string[] = [];
    for (const idx of indicesList) {
      if (idx >= OPT_SENTINEL_BASE) {
        const level = (idx - OPT_SENTINEL_BASE) * 1000;
        let count = 0;
        if (optCounters) {
          count = optCounters.get(level) ?? 0;
          optCounters.set(level, count + 1);
        }
        codes.push(`OPT ${level + count}`);
      } else if (idx < indices.courses.length) {
        const code = indices.courses[idx];
        if (catalogue.courses.some((c) => c.code === code)) codes.push(code);
      } else {
        codes.push(indices.courses[idx]);
      }
    }
    return codes;
  };

  const completedOptCounters = new Map<number, number>();
  const completedCourseCodes = state.completedCourses
    .map((v) => {
      if (v >= OPT_SENTINEL_BASE) {
        const level = (v - OPT_SENTINEL_BASE) * 1000;
        const count = completedOptCounters.get(level) ?? 0;
        completedOptCounters.set(level, count + 1);
        return `OPT ${level + count}`;
      }
      return v < indices.courses.length ? indices.courses[v] : null;
    })
    .filter(
      (c): c is string =>
        c !== null && (isOptCourse(c) || catalogue.courses.some((catC) => catC.code === c)),
    );

  const courseSelectionsOptCounters = new Map<number, number>();
  const courseSelections = state.courseSelections.map((sel) => ({
    reqIndex: sel.reqIndex,
    courseCodes: decodeCourseIndices(sel.courseIndices, courseSelectionsOptCounters).filter(
      (c) => c && (isOptCourse(c) || catalogue.courses.some((catC) => catC.code === c)),
    ),
  }));

  const constrainedOptCounters = new Map<number, number>();
  const constrainedSelections = state.constrainedSelections.map((sel) => ({
    reqIndex: sel.reqIndex,
    courseCodes: decodeCourseIndices(sel.courseIndices, constrainedOptCounters).filter(
      (c) => c && (isOptCourse(c) || catalogue.courses.some((catC) => catC.code === c)),
    ),
  }));

  const constrainedGroupSelections = state.constrainedGroupSelections.map((sel) => ({
    reqIndex: sel.reqIndex,
    groupPrefixes: sel.groupPrefixIndices
      .map((i) => (i < indices.disciplines.length ? indices.disciplines[i] : null))
      .filter((c): c is string => c !== null),
  }));

  const basketCourses = state.basicPinnedCourses
    .map((idx) => (idx < indices.courses.length ? indices.courses[idx] : null))
    .filter((c): c is string => c !== null);

  const blacklistedCourses = state.blacklistedCourses
    .map((idx) => (idx < indices.courses.length ? indices.courses[idx] : null))
    .filter((c): c is string => c !== null);

  return {
    wizardMode:
      state.wizardMode === WizardMode.WIZARD_MODE_BASIC
        ? "basic"
        : state.wizardMode === WizardMode.WIZARD_MODE_ADVANCED
          ? "advanced"
          : null,
    basketCourses,
    basicElectivesCount: state.basicElectivesCount,
    basicExcludedCategories: state.basicExcludedCategoryIndices
      .map((i) => (i < indices.disciplines.length ? indices.disciplines[i] : null))
      .filter((c): c is string => c !== null),

    selectedTermId: state.selectedTermId != null ? String(state.selectedTermId) : null,
    firstYear: state.firstYear ?? null,
    program,
    minorProgram,
    completedCourseCodes,
    levelBuckets: state.levelBuckets.map(protoToLevel),
    languageBuckets: state.languageBuckets.map(protoToLang),
    electiveLevelBuckets: state.electiveLevelBuckets,

    coursesThisSemester: state.coursesThisSemester,
    firstSeed: state.firstSeed,
    currentSeed: state.currentSeed,
    swaps: state.swaps.map((s) => ({
      enrollmentIndex: s.enrollmentIndex,
      courseCode: indices.courses[s.courseCodeIndex] ?? "",
    })),

    optionSelections: state.optionSelections.map((o) => ({
      reqIndex: o.reqIndex,
      optionIndex: o.optionIndex,
    })),
    courseSelections,
    constrainedSelections,
    constrainedGroupSelections,
    requirementPrioritySelections: state.requirementPriorities.map((p) => ({
      reqIndex: p.reqIndex,
      priority: p.priority,
    })),

    includeClosedComponents: state.includeClosedComponents,
    virtualSectionsOnly: state.virtualSectionsOnly,
    studentPrograms: state.studentProgramIndices
      .map((i) => (i < indices.disciplines.length ? indices.disciplines[i] : null))
      .filter((c): c is string => c !== null),

    touchedReqIndices: state.touchedReqIndices,

    generationMinStartMinutes: state.generationMinStartMinutes,
    generationMaxEndMinutes: state.generationMaxEndMinutes,
    generationLimitFirstYearCredits: state.generationLimitFirstYearCredits,
    optimizationPriorities: optimizationPrioritiesFromStateProto(state.optimizationPriorities),
    activeStep: state.activeStep ?? 0,
    showCalendar: state.showCalendar ?? false,
    frenchImmersionStream: state.frenchImmersionStream ?? false,
    calendarWeekIndex: state.calendarWeekIndex ?? null,
    blacklistedCourses,
    blockedTimes: (state.blockedTimes ?? []).map((b) => ({
      day: protoToDay(b.day as ProtoDayOfWeek),
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
    })),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const compressed = deflateSync(bytes, { level: 6 });
  let binary = "";
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array | null {
  try {
    // Normalize to standard base64: URLSearchParams.get() converts "+" to spaces,
    // and callers may pass base64url (which uses "-" and "_" instead of "+" and "/").
    const normalized = base64.replaceAll(" ", "+").replaceAll("-", "+").replaceAll("_", "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return inflateSync(bytes);
  } catch {
    return null;
  }
}

export function stateToShareUrl(encoded: Uint8Array, baseUrl: string): string {
  const q = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${q}s=${encodeURIComponent(bytesToBase64(encoded))}`;
}

export function parseStateFromUrl(search: string): Uint8Array | null {
  // Use URLSearchParams for robust parsing; note it decodes "+" as a space (x-www-form-urlencoded),
  // which base64ToBytes normalizes back to "+".
  const params = new URLSearchParams(search);
  const s = params.get("s");
  if (!s) return null;
  return base64ToBytes(s);
}

export function encodeStateToBase64(
  input: EncodeInput,
  catalogue: CatalogueLike,
  indices: Indices,
): string | null {
  const bytes = encodeState(input, catalogue, indices);
  if (!bytes) return null;
  return bytesToBase64(bytes);
}

export function decodeStateFromBase64(
  base64: string,
  catalogue: CatalogueLike,
  indices: Indices,
): DecodedState | DecodeError {
  const bytes = base64ToBytes(base64);
  if (!bytes) return { error: "Invalid state encoding" };
  return decodeState(bytes, catalogue, indices);
}

export function peekTermAndYearFromBase64(
  base64: string,
): { termId: string | null; firstYear: number | null } | null {
  const bytes = base64ToBytes(base64);
  if (!bytes) return null;
  return peekTermAndYear(bytes);
}

export function peekHasPersonalizedFromBase64(base64: string): boolean {
  const bytes = base64ToBytes(base64);
  if (!bytes) return false;
  return peekHasPersonalized(bytes);
}
