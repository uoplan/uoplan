/**
 * Layer 1 — CandidatePlan.
 *
 * A {@link CandidatePlan} is the output of *course selection*: a fully-decided,
 * fixed set of courses (pinned plus chosen optional picks) that fills the term's
 * course slots, together with the requirement each course was chosen for and the
 * per-plan data cache the timetabler must read sections from.
 *
 * Selecting *which* courses is kept strictly separate from *timetabling* them
 * (which section/time arrangement). The stream layer composes a lazy source of
 * CandidatePlans with the timetable enumerator, so the requirement mapping and
 * other metadata are carried alongside the course set instead of being thrown
 * away as the legacy pipeline did.
 */
import type { DataCache } from "../../dataCache";

export interface CandidatePlan {
  /** Full fixed course set for the term: pinned ∪ optional, sized to the target. */
  readonly courses: readonly string[];
  /** Courses forced into every timetable (explicit picks, honours projects). */
  readonly pinned: readonly string[];
  /** Optional picks chosen to fill the remaining slots. */
  readonly optionalPool: readonly string[];
  /** code -> requirementId the course was selected to satisfy. */
  readonly chosenFromPool: Readonly<Record<string, string>>;
  /**
   * Order-independent identity of the course *set*, used to dedup plans so the
   * stream surfaces distinct course sets (not just distinct seeds).
   */
  readonly courseSetKey: string;
  /**
   * The data cache the timetabler reads sections from for this plan. It may bake
   * in per-course filters (e.g. virtual-sections-only for broad electives) that
   * depend on which requirement each course was chosen for.
   */
  readonly cache: DataCache;
}

/** Stable set identity for a list of course codes (already normalised upstream). */
export function courseSetKey(courses: readonly string[]): string {
  return [...courses].sort().join(",");
}
