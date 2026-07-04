import type { PlannerTermStatus } from "../../store/graphPlannerStore";

/** Result of generating one future planner term. */
export interface PlannerTermOutcome {
  termId: string;
  /** Course codes the generator picked (normalized, in schedule order). */
  courses: string[];
  /** Requested course count for the term. */
  requestedCount: number;
  status: PlannerTermStatus;
}

/** Inputs describing which terms to plan and how many courses each should hold. */
export interface PlannerRunConfig {
  /** Future term ids to generate, in chronological order. */
  enabledTermIds: string[];
  /** Requested course count per term (falls back to {@link defaultCount}). */
  countByTermId: Record<string, number>;
  /** Default course count for terms without an explicit count. */
  defaultCount: number;
  /**
   * Courses the student pinned to a specific term (via editing it in the
   * calendar). They are forced into that term's schedule; the generator fills
   * the remaining slots toward the degree. Absent terms have no pins.
   */
  cartByTermId?: Record<string, string[]>;
}
