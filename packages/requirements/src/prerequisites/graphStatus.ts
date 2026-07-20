import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import {
  getLanguageVariant,
  normalizeCourseCode,
  parseCourseCode,
} from "@uoplan/domain/utils/courseUtils";
import type { PrereqContext } from "./types";
import type { PrereqNodeStatus } from "./graphTypes";

// Kleene three-state logic

function computeAndStatus(statuses: PrereqNodeStatus[]): PrereqNodeStatus {
  if (statuses.some((s) => s === "missing")) return "missing";
  if (statuses.every((s) => s === "met")) return "met";
  return "unknown";
}

function computeOrStatus(statuses: PrereqNodeStatus[]): PrereqNodeStatus {
  if (statuses.some((s) => s === "met")) return "met";
  if (statuses.every((s) => s === "missing")) return "missing";
  return "unknown";
}

// Credit evaluation (mirrors evaluator.ts logic for graph display)

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

function computeCreditsForNonCourse(node: CoursePrereqNode, ctx: PrereqContext): number {
  // Scoped children
  if (node.children?.length) {
    const codes = new Set<NormalizedCourseCode>();
    for (const child of node.children) {
      collectCourseCodes(child, codes);
    }
    if (codes.size === 0) return 0;
    return ctx.taken.reduce(
      (sum, course) => sum + (codes.has(course.code) ? course.credits : 0),
      0,
    );
  }

  // DisciplineLevels
  if (node.disciplineLevels?.length) {
    let sum = 0;
    for (const t of ctx.taken) {
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

  // Both disciplines and levels
  if (node.disciplines?.length && node.levels?.length) {
    let sum = 0;
    const dset = new Set(node.disciplines.map((d) => d.toUpperCase()));
    const allowed = new Set(node.levels);
    for (const t of ctx.taken) {
      if (!dset.has(t.discipline.toUpperCase())) continue;
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // Only levels
  if (node.levels?.length && (!node.disciplines || node.disciplines.length === 0)) {
    const allowed = new Set(node.levels);
    let sum = 0;
    for (const t of ctx.taken) {
      if (t.level != null && allowed.has(t.level)) sum += t.credits;
    }
    return sum;
  }

  // Only disciplines
  if (node.disciplines?.length) {
    return node.disciplines.reduce(
      (acc, d) => acc + (ctx.disciplineCredits[d.toUpperCase()] ?? 0),
      0,
    );
  }

  // Fallback: total credits
  return ctx.totalCredits;
}

// Shared status helpers (used by both visual topology and accessibility)

/** Compute taken/met status of a single course node. */
export function computeCourseTakenStatus(
  rawCode: string,
  ctx: PrereqContext | null,
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const normalized = normalizeCourseCode(rawCode);
  if (!parseCourseCode(rawCode)) return "unknown";
  const variant = getLanguageVariant(normalized);
  const found = ctx.taken.some(
    (c) => c.code === normalized || (variant !== null && c.code === variant),
  );
  return found ? "met" : "missing";
}

export function isResolvableCourse(rawCode: string, cache: DataCache | null): boolean {
  if (parseCourseCode(rawCode) === null) return false;
  if (cache === null) return true;
  return cache.getCourse(normalizeCourseCode(rawCode)) !== undefined;
}

export function computeProgramStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
): PrereqNodeStatus {
  if (!node.programs?.length) return "met";
  if (ctx === null || ctx.studentPrograms.length === 0) return "unknown";
  return node.programs.some((program) => ctx.studentPrograms.includes(program)) ? "met" : "missing";
}

/**
 * Compute gate status from already-resolved child statuses, applying the
 * programs predicate before Kleene logic.
 */
export function gateStatusFromChildren(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  kind: "and_gate" | "or_gate",
  childStatuses: PrereqNodeStatus[],
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  return kind === "and_gate" ? computeAndStatus(childStatuses) : computeOrStatus(childStatuses);
}

/**
 * Compute status for a non_course credit node: applies the programs predicate then
 * evaluates earned credits against the required threshold.
 * Returns "unknown" for opaque nodes (no credits) or when context is absent.
 */
export function computeNonCourseStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  if (node.credits == null) return "unknown";
  const earned = computeCreditsForNonCourse(node, ctx);
  return earned >= node.credits ? "met" : "missing";
}

export function computeNodeStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
): PrereqNodeStatus {
  switch (node.type) {
    case "course": {
      const programStatus = computeProgramStatus(node, ctx);
      return programStatus === "met"
        ? isResolvableCourse(node.code ?? "", cache)
          ? computeCourseTakenStatus(node.code ?? "", ctx)
          : "unknown"
        : programStatus;
    }
    case "and_group":
      return gateStatusFromChildren(
        node,
        ctx,
        "and_gate",
        (node.children ?? []).map((child) => computeNodeStatus(child, ctx, cache)),
      );
    case "or_group":
      return gateStatusFromChildren(
        node,
        ctx,
        "or_gate",
        (node.children ?? []).map((child) => computeNodeStatus(child, ctx, cache)),
      );
    case "non_course":
      return computeNonCourseStatus(node, ctx);
    default:
      return "unknown";
  }
}
