/**
 * {@link ConstraintPipeline} composes a set of {@link Constraint}s and evaluates
 * them by scope. Each evaluation short-circuits on the first rejecting active
 * constraint and (optionally) records a {@link RejectionTrace}, which powers the
 * relaxation diagnostics ("removing constraint X would unblock results").
 */
import type { ComponentSection } from "../../dataTypes";
import type { CourseEnrollment } from "../../generation";
import type { Constraint, ConstraintContext, CourseSetCtx, RejectionTrace } from "./types";

export type Tracer = (trace: RejectionTrace) => void;

export class ConstraintPipeline {
  private readonly constraints: Constraint[];

  constructor(constraints: readonly Constraint[]) {
    // Only active constraints participate; inert toggles are dropped up front.
    this.constraints = constraints.filter((c) => c.active);
  }

  /** All active constraints (for diagnostics enumeration / relaxation). */
  get active(): readonly Constraint[] {
    return this.constraints;
  }

  /** Returns a new pipeline with the given constraint id removed. */
  without(constraintId: string): ConstraintPipeline {
    return new ConstraintPipeline(this.constraints.filter((c) => c.id !== constraintId));
  }

  allowsCourse(courseCode: string, ctx: ConstraintContext, trace?: Tracer): boolean {
    for (const c of this.constraints) {
      if (c.allowsCourse && !c.allowsCourse(courseCode, ctx)) {
        trace?.({ scope: "course", constraintId: c.id, subject: courseCode });
        return false;
      }
    }
    return true;
  }

  allowsCandidate(courseCode: string, ctx: CourseSetCtx, trace?: Tracer): boolean {
    for (const c of this.constraints) {
      if (c.allowsCandidate && !c.allowsCandidate(courseCode, ctx)) {
        trace?.({ scope: "candidate", constraintId: c.id, subject: courseCode });
        return false;
      }
    }
    return true;
  }

  allowsCourseSet(courseCodes: readonly string[], ctx: ConstraintContext, trace?: Tracer): boolean {
    for (const c of this.constraints) {
      if (c.allowsCourseSet && !c.allowsCourseSet(courseCodes, ctx)) {
        trace?.({ scope: "course-set", constraintId: c.id, subject: courseCodes.join(",") });
        return false;
      }
    }
    return true;
  }

  allowsSection(
    courseCode: string,
    section: ComponentSection,
    ctx: ConstraintContext,
    trace?: Tracer,
  ): boolean {
    for (const c of this.constraints) {
      if (c.allowsSection && !c.allowsSection(courseCode, section, ctx)) {
        trace?.({
          scope: "section",
          constraintId: c.id,
          subject: `${courseCode}/${section.section}`,
        });
        return false;
      }
    }
    return true;
  }

  allowsEnrollment(
    candidate: CourseEnrollment,
    partial: readonly CourseEnrollment[],
    ctx: ConstraintContext,
    trace?: Tracer,
  ): boolean {
    for (const c of this.constraints) {
      if (c.allowsEnrollment && !c.allowsEnrollment(candidate, partial, ctx)) {
        trace?.({ scope: "enrollment", constraintId: c.id, subject: candidate.courseCode });
        return false;
      }
    }
    return true;
  }

  allowsFinalTimetable(
    enrollments: readonly CourseEnrollment[],
    ctx: ConstraintContext,
    trace?: Tracer,
  ): boolean {
    for (const c of this.constraints) {
      if (c.allowsFinalTimetable && !c.allowsFinalTimetable(enrollments, ctx)) {
        trace?.({
          scope: "final",
          constraintId: c.id,
          subject: enrollments.map((e) => e.courseCode).join(","),
        });
        return false;
      }
    }
    return true;
  }

  /** Product of all soft ordering weights (>0). Neutral = 1. */
  orderingWeight(courseCode: string, ctx: ConstraintContext): number {
    let w = 1;
    for (const c of this.constraints) {
      if (c.orderingWeight) {
        const cw = c.orderingWeight(courseCode, ctx);
        if (cw > 0) w *= cw;
      }
    }
    return w;
  }
}
