/**
 * Layer 0 — Constraints as first-class objects.
 *
 * The redesigned schedule pipeline expresses every hard filter and soft
 * preference as a {@link Constraint}. A constraint declares hooks only at the
 * stage(s) where it can decide, and the {@link ConstraintPipeline} routes each
 * hook to the earliest point in the search where it can prune. Pushing a
 * decision as early as possible ("propagate back up") is what keeps the lazy
 * enumeration efficient.
 *
 * Four pruning scopes, from earliest to latest:
 *   1. course           — is this course code ever eligible?
 *   2. course-set        — does a (partial/final) multiset of courses satisfy
 *                          structural rules (group tokens, credit caps)?
 *   3. section           — is a single section of a course usable?
 *   4. timetable         — incremental: does adding an enrollment keep the
 *                          partial timetable valid, and is the final one valid?
 *
 * Soft preferences never filter; they only bias enumeration order via
 * {@link Constraint.orderingWeight}.
 */
import type { ComponentSection } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { CourseEnrollment } from "../../generation";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";

/**
 * Read-only context shared by every constraint hook. Concrete constraints pull
 * only the fields they need. Kept intentionally small; selection-plan specific
 * data is passed through {@link CourseSetCtx}.
 */
export interface ConstraintContext {
  readonly cache: DataCache;
  /** Normalised codes of already-completed courses. */
  readonly completed: ReadonlySet<NormalizedCourseCode>;
  /** Normalised codes the student is allowed to take (prereqs satisfied). */
  readonly prereqEligible: ReadonlySet<NormalizedCourseCode>;
}

/** Additional context for course-set scoped hooks. */
export interface CourseSetCtx extends ConstraintContext {
  /** requirementId the course is being considered for, when known. */
  readonly requirementId?: string;
  /** requirementId -> requirement type, for type-dependent rules. */
  readonly requirementTypeById: ReadonlyMap<string, string | undefined>;
}

/** A single hard/soft rule. All hooks are optional; implement only what applies. */
export interface Constraint {
  /** Stable identifier, surfaced in diagnostics ("which constraint blocked"). */
  readonly id: string;
  /** Human-facing short label for diagnostics, already localisation-ready id. */
  readonly label: string;
  /** When false the constraint is inert (e.g. a toggle the user left off). */
  readonly active: boolean;

  /** Course scope: may this course ever be scheduled? */
  allowsCourse?(courseCode: NormalizedCourseCode, ctx: ConstraintContext): boolean;

  /** Course-set scope: may this course fill the given requirement slot? */
  allowsCandidate?(courseCode: NormalizedCourseCode, ctx: CourseSetCtx): boolean;

  /** Section scope: is this section of the course usable under the constraint? */
  allowsSection?(
    courseCode: NormalizedCourseCode,
    section: ComponentSection,
    ctx: ConstraintContext,
  ): boolean;

  /**
   * Timetable scope (incremental): may `candidate` be added to a timetable that
   * already contains `partial`? Used to prune deep in the backtracking solver.
   * Overlap and other pairwise rules belong here.
   */
  allowsEnrollment?(
    candidate: CourseEnrollment,
    partial: readonly CourseEnrollment[],
    ctx: ConstraintContext,
  ): boolean;

  /** Timetable scope: is a complete timetable valid? */
  allowsFinalTimetable?(enrollments: readonly CourseEnrollment[], ctx: ConstraintContext): boolean;

  /**
   * Soft ordering: relative weight (>0) used to bias the seeded enumeration
   * order toward preferred courses. 1 = neutral. Never filters.
   */
  orderingWeight?(courseCode: NormalizedCourseCode, ctx: ConstraintContext): number;
}

/** Why a constraint pipeline rejected a candidate, for diagnostics/tracing. */
export interface RejectionTrace {
  scope: "course" | "candidate" | "course-set" | "section" | "enrollment" | "final";
  constraintId: string;
  subject: string;
}
