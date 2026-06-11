import type { CoursePrereqKind, CoursePrereqNode } from "../dataTypes";
import type { DataCache } from "../dataCache";
import type { NormalizedCourseCode } from "../brand";
import { getLanguageVariant, normalizeCourseCode } from "../utils/courseUtils";
import type { PrereqContext } from "./types";

/**
 * Soft `non_course` kinds the planner cannot model from a student's course
 * history (administrative, external, or high-school requirements). These are
 * treated as satisfiable so a course gated only by e.g. "Permission of the
 * Department" or "audition" is not permanently unschedulable.
 *
 * Conservative kinds (`equivalent`, `standing`, `coursework`, `knowledge`) are
 * deliberately NOT included: they can represent real academic gates, so they
 * remain blocking to avoid producing impossible schedules.
 */
const SOFT_PREREQ_KINDS: ReadonlySet<CoursePrereqKind> = new Set<CoursePrereqKind>([
  "permission",
  "audition",
  "language",
  "highschool",
  "recommended",
  "topic",
]);

function isSoftNonCourse(node: CoursePrereqNode): boolean {
  return (
    node.type === "non_course" &&
    node.credits == null &&
    node.kind !== undefined &&
    SOFT_PREREQ_KINDS.has(node.kind)
  );
}

export function meetsCoursePrereq(
  node: CoursePrereqNode,
  ctx: PrereqContext,
  inOrGroup = false,
): boolean {
  if (node.programs && node.programs.length > 0) {
    const inProgram = node.programs.some((p) => ctx.studentPrograms.includes(p));
    if (!inProgram) return false;
  }

  switch (node.type) {
    case "course":
      return evaluateCourseRequirement(node, ctx);
    case "and_group":
      return (node.children ?? []).every((child) => meetsCoursePrereq(child, ctx, false));
    case "or_group":
      return (node.children ?? []).some((child) => meetsCoursePrereq(child, ctx, true));
    case "non_course":
      return evaluateNonCourseRequirement(node, ctx, inOrGroup);
    default:
      return true;
  }
}

function evaluateCourseRequirement(node: CoursePrereqNode, ctx: PrereqContext): boolean {
  if (!node.code) return true;
  const target = normalizeCourseCode(node.code);
  const variant = getLanguageVariant(target);
  return ctx.taken.some((c) => c.code === target || (variant !== null && c.code === variant));
}

function collectCourseCodes(node: CoursePrereqNode, codes: Set<NormalizedCourseCode>): void {
  if (node.type === "course" && node.code) {
    const target = normalizeCourseCode(node.code);
    const variant = getLanguageVariant(target);
    codes.add(target);
    if (variant !== null) codes.add(variant);
  }

  for (const child of node.children ?? []) {
    collectCourseCodes(child, codes);
  }
}

function creditsMatchingScopedChildren(node: CoursePrereqNode, ctx: PrereqContext): number {
  const codes = new Set<NormalizedCourseCode>();
  for (const child of node.children ?? []) {
    collectCourseCodes(child, codes);
  }

  if (codes.size === 0) return 0;
  return ctx.taken.reduce((sum, course) => sum + (codes.has(course.code) ? course.credits : 0), 0);
}

function evaluateNonCourseRequirement(
  node: CoursePrereqNode,
  ctx: PrereqContext,
  inOrGroup: boolean,
): boolean {
  const credits = node.credits;

  if (credits == null) {
    // Soft, planner-external requirements (permission, audition, language, …)
    // are treated as satisfiable so the course stays schedulable — except inside
    // an or_group, where letting the soft branch pass would trivially satisfy the
    // whole disjunction and hide the real (course) alternative.
    if (isSoftNonCourse(node)) return !inOrGroup;

    // Other descriptive clauses (standing, equivalent, unclassified, …) are not
    // modeled; stay conservative and keep the course ineligible.
    return false;
  }

  if (node.children?.length) {
    return creditsMatchingScopedChildren(node, ctx) >= credits;
  }

  return creditsMatchingNonCourse(node, ctx) >= credits;
}

function creditsMatchingNonCourse(node: CoursePrereqNode, ctx: PrereqContext): number {
  const taken = ctx.taken;

  // 1. Specific discipline + level constraints
  if (node.disciplineLevels?.length) {
    let sum = 0;
    for (const t of taken) {
      for (const dl of node.disciplineLevels) {
        if (dl.discipline.toUpperCase() !== t.discipline.toUpperCase()) continue;
        const allowed = dl.levels;
        if (!allowed?.length) {
          sum += t.credits;
          break;
        }
        if (t.level != null && allowed.includes(t.level)) {
          sum += t.credits;
          break;
        }
      }
    }
    return sum;
  }

  // 2. Both disciplines and levels constrained
  if (node.disciplines?.length && node.levels?.length) {
    let sum = 0;
    const dset = new Set(node.disciplines.map((d) => d.toUpperCase()));
    const allowed = new Set(node.levels);
    for (const t of taken) {
      if (!dset.has(t.discipline.toUpperCase())) continue;
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // 3. Only levels constrained
  if (node.levels?.length && (!node.disciplines || node.disciplines.length === 0)) {
    const allowed = new Set(node.levels);
    let sum = 0;
    for (const t of taken) {
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // 4. Only disciplines constrained
  if (node.disciplines?.length) {
    return node.disciplines.reduce(
      (acc, d) => acc + (ctx.disciplineCredits[d.toUpperCase()] ?? 0),
      0,
    );
  }

  // 5. No specific constraints -> fallback to total credits
  return ctx.totalCredits;
}

/**
 * True if the prerequisite tree contains any `non_course` node that the planner
 * actually treats as a constraint (standing, credit pools, unclassified
 * requirements). Soft, planner-external kinds (permission, audition, …) are
 * excluded so courses gated only by them are not deprioritized when sampling
 * schedules. Used to deprioritize genuinely-constrained courses.
 */
export function prerequisitesContainNonCourse(node: CoursePrereqNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "non_course" && !isSoftNonCourse(node)) return true;
  for (const child of node.children ?? []) {
    if (prerequisitesContainNonCourse(child)) return true;
  }
  return false;
}

export function canTakeCourse(courseCode: string, cache: DataCache, ctx: PrereqContext): boolean {
  const course = cache.getCourse(courseCode);
  if (!course) return false;
  const prereq = course.prerequisites;
  if (!prereq) return true;
  return meetsCoursePrereq(prereq, ctx);
}
