import { buildDataCache, type DataCache } from "@uoplan/core/dataCache";
import type {
  Catalogue,
  DisciplinesData,
  Program,
  ProgramRequirement,
  SchedulesData,
} from "@uoplan/core/dataTypes";
import {
  buildEffectiveRemainingRequirements,
  buildPrereqContext,
  canTakeCourse,
  collectRequirementIds,
  gateRemainingByPriority,
  type AdvancedRequestInput,
  type CourseLanguageBucket,
  type CourseLevelBucket,
} from "@uoplan/core";
import {
  computeRequirementsState,
  type CompletedRequirementItem,
  type RemainingRequirement,
  type RequirementWithStatus,
} from "@uoplan/core/requirements";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

// Building the DataCache over the full catalogue (~thousands of courses) is
// expensive, and requirement evaluation only reads its course lookups — never
// the schedule map — so we memoise one cache per catalogue identity. This keeps
// recomputation cheap as the basket changes on every keystroke. Mirrors the
// WeakMap memoisation in lib/generate-schedule.ts.
const cacheByCatalogue = new WeakMap<Catalogue, DataCache>();

function requirementCacheFor(
  catalogue: Catalogue,
  schedules: SchedulesData,
  disciplines?: DisciplinesData,
): DataCache {
  const hit = cacheByCatalogue.get(catalogue);
  if (hit) return hit;
  const cache = buildDataCache(catalogue, schedules, disciplines);
  cacheByCatalogue.set(catalogue, cache);
  return cache;
}

export interface PersonalizeRequirementsInput {
  catalogue: Catalogue;
  schedules: SchedulesData;
  disciplines?: DisciplinesData;
  /** The selected program's catalogue URL, or null when none is chosen. */
  programUrl: string | null;
  /** Course codes the student has completed (the native basket). */
  completedCourses: readonly string[];
  /** Interactive native requirement choices from the Personalize wizard. */
  selections?: PersonalizeRequirementSelections;
}

export interface PersonalizeRequirementSelections {
  selectedOptionsPerRequirement: Record<string, number>;
  selectedPerRequirement: Record<string, string[]>;
  constrainedPerRequirement: Record<string, string[]>;
  requirementPriorities: Record<string, number>;
  coursesThisSemester: number;
}

export const DEFAULT_COURSES_THIS_SEMESTER = 5;

export const DEFAULT_REQUIREMENT_SELECTIONS: PersonalizeRequirementSelections = {
  selectedOptionsPerRequirement: {},
  selectedPerRequirement: {},
  constrainedPerRequirement: {},
  requirementPriorities: {},
  coursesThisSemester: DEFAULT_COURSES_THIS_SEMESTER,
};

/**
 * A native, read-only projection of a program's requirement progress, computed
 * by the same `@uoplan/core` evaluator the web personalize page uses. `remaining`
 * lists the outstanding requirement blocks (with their candidate courses);
 * `completed` lists requirements already satisfied by the basket.
 */
export interface PersonalizeRequirementsReadout {
  programTitle: string;
  remaining: RemainingRequirement[];
  completed: CompletedRequirementItem[];
  remainingCount: number;
  /**
   * Completed courses that are still eligible candidates for a remaining
   * requirement but have not been assigned (or auto-satisfied) yet — i.e. the
   * courses the planner still shows an "Assign" prompt for. The final CTA gates
   * on this being empty, not on every requirement being met.
   */
  unassignedCompletedCourses: string[];
  requirementTreeWithStatus?: RequirementWithStatus[];
  selectedOptionsPerRequirement?: Record<string, number>;
  selectedPerRequirement?: Record<string, string[]>;
  constrainedPerRequirement?: Record<string, string[]>;
  requirementPriorities?: Record<string, number>;
  coursesThisSemester?: number;
  projectedRemainingCount?: number;
}

export interface NativeScheduleRequirementContext {
  programUrl: string | null;
  /** Completed courses are not scheduled; they inform prerequisite and requirement state. */
  completedCourses?: readonly string[];
  selections?: PersonalizeRequirementSelections;
}

export interface PersonalizeAdvancedRequirements {
  program: Program;
  completedCourses: string[];
  remainingRequirements: RemainingRequirement[];
  requirementTreeWithStatus: RequirementWithStatus[];
  selectedOptionsPerRequirement: Record<string, number>;
  selectedPerRequirement: Record<string, string[]>;
  constrainedPerRequirement: Record<string, string[]>;
  requirementPriorities: Record<string, number>;
  coursesThisSemester: number;
  prereqEligibleCourses: string[];
}

let activeScheduleRequirementContext: NativeScheduleRequirementContext | null = null;
const scheduleRequirementListeners = new Set<() => void>();

export function buildRequirementCandidateSet(
  remainingRequirements: RemainingRequirement[],
  completedCourses: readonly string[] = [],
): Set<string> {
  const completed = new Set(completedCourses.map((code) => normalizeCourseCode(code)));
  const candidates = new Set<string>();
  for (const requirement of remainingRequirements) {
    for (const candidate of requirement.candidateCourses ?? []) {
      const normalized = normalizeCourseCode(candidate);
      if (!completed.has(normalized)) candidates.add(normalized);
    }
  }
  return candidates;
}

function cloneSelections(
  selections: PersonalizeRequirementSelections | undefined,
): PersonalizeRequirementSelections {
  return {
    selectedOptionsPerRequirement: { ...(selections?.selectedOptionsPerRequirement ?? {}) },
    selectedPerRequirement: cloneStringRecord(selections?.selectedPerRequirement ?? {}),
    constrainedPerRequirement: cloneStringRecord(selections?.constrainedPerRequirement ?? {}),
    requirementPriorities: { ...(selections?.requirementPriorities ?? {}) },
    coursesThisSemester: Math.max(
      1,
      Math.trunc(selections?.coursesThisSemester ?? DEFAULT_COURSES_THIS_SEMESTER),
    ),
  };
}

function cloneStringRecord(record: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(record)) {
    if (values.length > 0) out[key] = [...values];
  }
  return out;
}

function writeSelectionList(
  record: Record<string, string[]>,
  requirementId: string,
  values: string[],
): Record<string, string[]> {
  const next = cloneStringRecord(record);
  if (values.length > 0) next[requirementId] = values;
  else delete next[requirementId];
  return next;
}

function appendOrRemoveNormalized(values: string[], rawCode: string): string[] {
  const code = normalizeCourseCode(rawCode);
  const existingIndex = values.findIndex((value) => normalizeCourseCode(value) === code);
  if (existingIndex >= 0) {
    return [...values.slice(0, existingIndex), ...values.slice(existingIndex + 1)];
  }
  return [...values, code];
}

export function setSelectedOptionForRequirement(
  selections: PersonalizeRequirementSelections,
  requirementId: string,
  optionIndex: number,
): PersonalizeRequirementSelections {
  const next = cloneSelections(selections);
  next.selectedOptionsPerRequirement[requirementId] = Math.max(0, Math.trunc(optionIndex));
  return next;
}

export function clearSelectedOptionForRequirement(
  selections: PersonalizeRequirementSelections,
  requirementId: string,
): PersonalizeRequirementSelections {
  const next = cloneSelections(selections);
  const prefix = `${requirementId}-`;
  for (const key of Object.keys(next.selectedOptionsPerRequirement)) {
    if (key === requirementId || key.startsWith(prefix)) {
      delete next.selectedOptionsPerRequirement[key];
    }
  }
  return next;
}

export function toggleRequirementCourse(
  selections: PersonalizeRequirementSelections,
  requirementId: string,
  rawCode: string,
  bucket: "assigned" | "pinned",
): PersonalizeRequirementSelections {
  const next = cloneSelections(selections);
  const key = bucket === "assigned" ? "selectedPerRequirement" : "constrainedPerRequirement";
  const current = next[key][requirementId] ?? [];
  next[key] = writeSelectionList(
    next[key],
    requirementId,
    appendOrRemoveNormalized(current, rawCode),
  );
  return next;
}

export function setRequirementPriorityForIds(
  selections: PersonalizeRequirementSelections,
  requirementIds: readonly string[],
  priority: number,
): PersonalizeRequirementSelections {
  const next = cloneSelections(selections);
  const value = Math.max(0, Math.trunc(priority));
  for (const requirementId of requirementIds) {
    if (value === 0) delete next.requirementPriorities[requirementId];
    else next.requirementPriorities[requirementId] = value;
  }
  return next;
}

export function setCoursesThisSemester(
  selections: PersonalizeRequirementSelections,
  coursesThisSemester: number,
): PersonalizeRequirementSelections {
  return {
    ...cloneSelections(selections),
    coursesThisSemester: Math.max(1, Math.trunc(coursesThisSemester)),
  };
}

export function getRequirementPriorityForIds(
  selections: PersonalizeRequirementSelections,
  requirementIds: readonly string[],
): number {
  let max = 0;
  for (const requirementId of requirementIds) {
    max = Math.max(max, selections.requirementPriorities[requirementId] ?? 0);
  }
  return max;
}

export function requirementIdsForNode(node: RequirementWithStatus): string[] {
  return collectRequirementIds(node);
}

/** True when an incomplete node (or any descendant) is an unresolved option group. */
export function nodeHasOptionGroups(node: RequirementWithStatus): boolean {
  if (node.complete) return false;
  if ((node.type === "or_group" || node.type === "options_group") && node.requirementId != null) {
    return true;
  }
  return node.options?.some(nodeHasOptionGroups) ?? false;
}

/** True when the program tree exposes at least one path/option choice to make. */
export function programHasOptionGroups(nodes: readonly RequirementWithStatus[]): boolean {
  return nodes.some(nodeHasOptionGroups);
}

/**
 * True when any incomplete option group (or a selected branch's nested option
 * group) still lacks a valid selection. Mirrors web's `hasMissingOptionSelections`
 * so the final CTA stays gated until every path is chosen.
 */
export function hasMissingProgramOptions(
  nodes: readonly RequirementWithStatus[],
  selectedOptions: Record<string, number>,
): boolean {
  for (const node of nodes) {
    if (node.complete) continue;
    const isOptionType = node.type === "or_group" || node.type === "options_group";
    if (isOptionType && node.requirementId != null) {
      const idx = selectedOptions[node.requirementId];
      const options = node.options ?? [];
      if (idx == null || idx < 0 || idx >= options.length) return true;
      const child = options[idx];
      if (child && hasMissingProgramOptions([child], selectedOptions)) return true;
    } else if (node.options?.length && hasMissingProgramOptions(node.options, selectedOptions)) {
      return true;
    }
  }
  return false;
}

function normalizeTitleForCompare(title: string | undefined): string {
  return (title ?? "").trim().replaceAll(/\s+/g, " ").toLowerCase();
}

/**
 * Collapse "wrapper around a single child" chains so the option tree doesn't
 * render a stack of redundant one-child groups. Ported from web's
 * `simplifySingleChildChain`.
 */
export function simplifySingleChildChain(node: RequirementWithStatus): RequirementWithStatus {
  let current = node;
  while (
    current.requirementId == null &&
    current.options &&
    current.options.length === 1 &&
    current.options[0] &&
    (current.options[0].options?.length ?? 0) > 0 &&
    (() => {
      const parentT = normalizeTitleForCompare(current.title);
      const childT = normalizeTitleForCompare(current.options[0]!.title);
      const parentGeneric = parentT === "" || parentT === "or";
      const childGeneric = childT === "" || childT === "or";
      return parentGeneric || childGeneric || parentT === childT;
    })()
  ) {
    const child = current.options[0]!;
    current = {
      ...child,
      title: (current.title ?? "").trim() ? current.title : child.title,
      code: current.code ?? child.code,
    };
  }
  return current;
}

/** Human-readable title for a requirement node. Ported from web. */
export function getNodeDisplayTitle(node: RequirementWithStatus): string {
  const rawTitle = (node.title ?? "").trim();
  const fallback = rawTitle || node.code || `${node.type} requirement`;
  if (node.type === "or_group") {
    const useGenericLabel = rawTitle === "" || rawTitle.toLowerCase() === "or";
    return useGenericLabel ? "One of the following" : fallback;
  }
  return fallback;
}

/** One-line hint under an option (credits, pool size, nested groups). Ported from web. */
export function getOptionSecondarySummaryLine(node: RequirementWithStatus): string | null {
  const parts: string[] = [];
  const credits = node.creditsNeeded ?? 0;
  if (credits > 0) {
    parts.push(`${credits} credit${credits === 1 ? "" : "s"} required`);
  }
  const n = node.candidateCourses?.length ?? 0;
  if (n > 0) {
    parts.push(`${n} possible course${n === 1 ? "" : "s"}`);
  }
  if (nodeHasOptionGroups(node)) {
    parts.push("further choices below");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function requirementLabel(type: string): string {
  switch (type) {
    case "discipline_elective":
      return "Discipline elective";
    case "faculty_elective":
      return "Faculty elective";
    case "credit_count":
      return "Course units";
    case "or_group":
    case "or_course":
      return "Choose one";
    default:
      return "Requirement";
  }
}

export function setActiveScheduleRequirementContext(
  context: NativeScheduleRequirementContext | null,
): void {
  activeScheduleRequirementContext = context
    ? {
        programUrl: context.programUrl,
        ...(context.completedCourses ? { completedCourses: [...context.completedCourses] } : {}),
        selections: cloneSelections(context.selections),
      }
    : null;
  for (const listener of scheduleRequirementListeners) listener();
}

export function getActiveScheduleRequirementContext(): NativeScheduleRequirementContext | null {
  if (!activeScheduleRequirementContext) return null;
  return {
    programUrl: activeScheduleRequirementContext.programUrl,
    ...(activeScheduleRequirementContext.completedCourses
      ? { completedCourses: [...activeScheduleRequirementContext.completedCourses] }
      : {}),
    selections: cloneSelections(activeScheduleRequirementContext.selections),
  };
}

export function subscribeScheduleRequirementContext(listener: () => void): () => void {
  scheduleRequirementListeners.add(listener);
  return () => {
    scheduleRequirementListeners.delete(listener);
  };
}

function findProgram(catalogue: Catalogue, programUrl: string | null): Program | null {
  if (!programUrl) return null;
  return catalogue.programs.find((entry) => entry.url === programUrl) ?? null;
}

// TODO(native parity): This pure helper lives in apps/web/src/store/requirementCompute/utils.ts.
// Move it to @uoplan/core so web and native stop carrying separate copies.
function getDisciplineCodesForProgram(program: Program | null): string[] {
  const codes = new Set<string>();
  if (!program) return [];

  function walk(node: ProgramRequirement): void {
    if (node.type === "course" && node.code) {
      const match = node.code.match(/^([a-zA-Z]+)\s/);
      if (match) codes.add(match[1]!.toUpperCase());
    }
    if (node.options) {
      for (const option of node.options) walk(option);
    }
  }

  for (const requirement of program.requirements) walk(requirement);
  return [...codes];
}

// TODO(native parity): Mirrors apps/web/src/lib/requirements/requirementUtils.ts.
// Keep this tiny projection local until the option/assignment tree helpers move to @uoplan/core.
function projectedNodeComplete(
  node: RequirementWithStatus,
  selections: Record<string, string[]>,
  cache: DataCache,
): boolean {
  if (node.complete) return true;
  const assigned = node.requirementId ? (selections[node.requirementId] ?? []) : [];
  const assignedCredits = assigned.reduce(
    (sum, code) => sum + (cache.getCourse(normalizeCourseCode(code))?.credits ?? 3),
    0,
  );
  const creditsNeeded = node.creditsNeeded ?? 0;
  if (creditsNeeded > 0 && assignedCredits >= creditsNeeded) return true;
  if (!node.options?.length) return false;
  if (node.type === "or_group" || node.type === "options_group") {
    return node.options.some((child) => projectedNodeComplete(child, selections, cache));
  }
  return node.options.every((child) => projectedNodeComplete(child, selections, cache));
}

function projectedRemainingCount(
  tree: RequirementWithStatus[],
  selections: PersonalizeRequirementSelections,
  cache: DataCache,
): number {
  const planned: Record<string, string[]> = {
    ...cloneStringRecord(selections.selectedPerRequirement),
  };
  for (const [requirementId, codes] of Object.entries(selections.constrainedPerRequirement)) {
    planned[requirementId] = [...(planned[requirementId] ?? []), ...codes];
  }
  return tree.filter((node) => !projectedNodeComplete(node, planned, cache)).length;
}

function selectedCredits(
  requirementId: string,
  selections: PersonalizeRequirementSelections,
  cache: DataCache,
): { credits: number; codes: string[] } {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const code of [
    ...(selections.selectedPerRequirement[requirementId] ?? []),
    ...(selections.constrainedPerRequirement[requirementId] ?? []),
  ]) {
    const norm = normalizeCourseCode(code);
    if (seen.has(norm)) continue;
    seen.add(norm);
    codes.push(cache.getCourse(norm)?.code ?? norm);
  }
  return {
    codes,
    credits: codes.reduce(
      (sum, code) => sum + (cache.getCourse(normalizeCourseCode(code))?.credits ?? 3),
      0,
    ),
  };
}

function applySelectionsToRemainingReadout(
  remaining: RemainingRequirement[],
  completed: CompletedRequirementItem[],
  selections: PersonalizeRequirementSelections,
  cache: DataCache,
): { remaining: RemainingRequirement[]; completed: CompletedRequirementItem[] } {
  const nextRemaining: RemainingRequirement[] = [];
  const plannedCompleted = [...completed];

  for (const requirement of remaining) {
    const selected = selectedCredits(requirement.requirementId, selections, cache);
    if (selected.codes.length === 0) {
      nextRemaining.push(requirement);
      continue;
    }

    const creditsNeeded = requirement.creditsNeeded ?? 0;
    if (creditsNeeded > 0 && selected.credits >= creditsNeeded) {
      plannedCompleted.push({
        title: requirement.title ?? requirementLabel(requirement.type),
        satisfiedBy: selected.codes,
      });
      continue;
    }

    nextRemaining.push({
      ...requirement,
      ...(creditsNeeded > 0
        ? { creditsNeeded: Math.max(0, creditsNeeded - selected.credits) }
        : {}),
      satisfiedBy: [...requirement.satisfiedBy, ...selected.codes],
    });
  }

  return { remaining: nextRemaining, completed: plannedCompleted };
}

/**
 * Completed courses that are still listed as an eligible candidate for one of the
 * outstanding requirements yet have not been assigned (manually or auto) to any
 * requirement. These are exactly the courses the planner surfaces an "Assign"
 * chip for; the final CTA stays gated until the list is empty so the student
 * isn't forced to satisfy every degree requirement before generating.
 */
function computeUnassignedCompletedCourses(
  remaining: RemainingRequirement[],
  completed: CompletedRequirementItem[],
  selections: PersonalizeRequirementSelections,
  completedCourses: readonly string[],
  cache: DataCache,
): string[] {
  const assigned = new Set<string>();
  for (const requirement of remaining) {
    for (const code of requirement.satisfiedBy) assigned.add(normalizeCourseCode(code));
  }
  for (const item of completed) {
    for (const code of item.satisfiedBy) assigned.add(normalizeCourseCode(code));
  }
  for (const codes of Object.values(selections.selectedPerRequirement)) {
    for (const code of codes) assigned.add(normalizeCourseCode(code));
  }

  const completedNorm = new Set(completedCourses.map((code) => normalizeCourseCode(code)));
  const unassigned = new Set<string>();
  for (const requirement of remaining) {
    for (const candidate of requirement.candidateCourses ?? []) {
      const norm = normalizeCourseCode(candidate);
      if (completedNorm.has(norm) && !assigned.has(norm)) unassigned.add(norm);
    }
  }
  return [...unassigned].map((norm) => cache.getCourse(norm)?.code ?? norm);
}

function buildPrereqEligibleCourses(input: {
  program: Program;
  remainingRequirements: RemainingRequirement[];
  completedCourses: readonly string[];
  cache: DataCache;
}): string[] {
  const ctx = buildPrereqContext(
    [...input.completedCourses],
    input.cache,
    getDisciplineCodesForProgram(input.program),
  );
  const candidateSet = new Set<string>();
  for (const requirement of input.remainingRequirements) {
    for (const code of requirement.candidateCourses) candidateSet.add(code);
  }
  for (const course of input.cache.getAllCourses()) candidateSet.add(course.code);

  const eligible: string[] = [];
  for (const code of candidateSet) {
    if (canTakeCourse(code, input.cache, ctx)) eligible.push(code);
  }
  return eligible;
}

/**
 * Resolve the selected program's requirement status against the completed-course
 * basket. Returns `null` when no program is selected or the URL is unknown so the
 * caller can render the empty "pick a program first" state. The cache is built
 * per call; callers should memoise on the catalogue/basket identity.
 */
export function computePersonalizeRequirements(
  input: PersonalizeRequirementsInput,
): PersonalizeRequirementsReadout | null {
  const program = findProgram(input.catalogue, input.programUrl);
  if (!program) return null;

  const cache = requirementCacheFor(input.catalogue, input.schedules, input.disciplines);
  const selections = cloneSelections(input.selections);
  const state = computeRequirementsState(
    program,
    [...input.completedCourses],
    cache,
    selections.selectedOptionsPerRequirement,
  );
  const adjusted = applySelectionsToRemainingReadout(
    state.remaining,
    state.completedList,
    selections,
    cache,
  );

  return {
    programTitle: program.title,
    remaining: adjusted.remaining,
    completed: adjusted.completed,
    remainingCount: adjusted.remaining.length,
    unassignedCompletedCourses: computeUnassignedCompletedCourses(
      adjusted.remaining,
      adjusted.completed,
      selections,
      input.completedCourses,
      cache,
    ),
    requirementTreeWithStatus: state.tree,
    selectedOptionsPerRequirement: selections.selectedOptionsPerRequirement,
    selectedPerRequirement: selections.selectedPerRequirement,
    constrainedPerRequirement: selections.constrainedPerRequirement,
    requirementPriorities: selections.requirementPriorities,
    coursesThisSemester: selections.coursesThisSemester,
    projectedRemainingCount: projectedRemainingCount(state.tree, selections, cache),
  };
}

export function buildPersonalizeAdvancedRequirements(input: {
  catalogue: Catalogue;
  cache: DataCache;
  programUrl: string | null;
  completedCourses?: readonly string[];
  selections?: PersonalizeRequirementSelections;
}): PersonalizeAdvancedRequirements | null {
  const program = findProgram(input.catalogue, input.programUrl);
  if (!program) return null;

  const selections = cloneSelections(input.selections);
  const completedCourses = [...(input.completedCourses ?? [])];
  const state = computeRequirementsState(
    program,
    completedCourses,
    input.cache,
    selections.selectedOptionsPerRequirement,
  );
  const priorityGated = gateRemainingByPriority(state.remaining, selections.requirementPriorities);
  const effectiveRemaining = buildEffectiveRemainingRequirements(
    priorityGated,
    state.tree,
    selections.selectedOptionsPerRequirement,
  );

  return {
    program,
    completedCourses,
    remainingRequirements: priorityGated,
    requirementTreeWithStatus: state.tree,
    selectedOptionsPerRequirement: selections.selectedOptionsPerRequirement,
    selectedPerRequirement: selections.selectedPerRequirement,
    constrainedPerRequirement: selections.constrainedPerRequirement,
    requirementPriorities: selections.requirementPriorities,
    coursesThisSemester: selections.coursesThisSemester,
    prereqEligibleCourses: buildPrereqEligibleCourses({
      program,
      remainingRequirements: effectiveRemaining,
      completedCourses,
      cache: input.cache,
    }),
  };
}

export function buildAdvancedRequestInputFromPersonalize(input: {
  requirements: PersonalizeAdvancedRequirements;
  constraints: AdvancedRequestInput["constraints"];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  optimizationPriorities: AdvancedRequestInput["optimizationPriorities"];
  courseSentimentByNorm: AdvancedRequestInput["courseSentimentByNorm"];
  levelBuckets?: CourseLevelBucket[];
  languageBuckets?: CourseLanguageBucket[];
  basicExcludedCategories?: string[];
  frenchImmersionStream?: boolean;
  blacklistedCourses: string[];
  currentSeed: number;
  firstSeed: number;
}): AdvancedRequestInput {
  const { requirements } = input;
  return {
    constraints: input.constraints,
    completedCourses: requirements.completedCourses,
    prereqEligibleCourses: requirements.prereqEligibleCourses,
    remainingRequirements: requirements.remainingRequirements,
    requirementTreeWithStatus: requirements.requirementTreeWithStatus,
    constrainedPerRequirementRaw: requirements.constrainedPerRequirement,
    selectedPerRequirement: requirements.selectedPerRequirement,
    selectedOptionsPerRequirement: requirements.selectedOptionsPerRequirement,
    coursesThisSemester: requirements.coursesThisSemester,
    forcedCourses: [],
    levelBuckets: input.levelBuckets ?? (["undergrad", "grad"] satisfies CourseLevelBucket[]),
    languageBuckets:
      input.languageBuckets ?? (["en", "fr", "other"] satisfies CourseLanguageBucket[]),
    electiveLevelBuckets:
      (requirements as { electiveLevelBuckets?: number[] }).electiveLevelBuckets ?? [],
    includeClosedComponents: input.includeClosedComponents,
    virtualSectionsOnly: input.virtualSectionsOnly,
    optimizationPriorities: input.optimizationPriorities,
    courseSentimentByNorm: input.courseSentimentByNorm,
    frenchImmersionStream: input.frenchImmersionStream ?? false,
    blacklistedCourses: input.blacklistedCourses,
    basicExcludedCategories: input.basicExcludedCategories ?? [],
    currentSeed: input.currentSeed,
    firstSeed: input.firstSeed,
  };
}
