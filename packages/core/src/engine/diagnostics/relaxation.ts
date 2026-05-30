/**
 * Relaxation diagnostics: instead of guessing, this actually re-runs the bounded
 * timetable search with one constraint removed at a time and reports which
 * constraint (if any) is genuinely responsible for "no clash-free timetable".
 *
 * This is the modular replacement for the legacy diagnostics, which only listed
 * every active constraint generically without testing whether any of them was
 * the real blocker. It leans on {@link ConstraintPipeline.without} — the payoff
 * of modelling constraints as first-class, individually removable objects.
 */
import type { DataCache } from "../../dataCache";
import type { GenerationConstraints } from "../../generation";
import { buildHardConstraintPipeline } from "../constraints/builtins";
import { ConstraintPipeline } from "../constraints/pipeline";
import type { ConstraintContext } from "../constraints/types";
import { firstSubsetArrangement } from "../timetable/subsetEnumerator";

/** Hard structural constraints the user cannot relax (never suggested). */
const STRUCTURAL_IDS: ReadonlySet<string> = new Set(["overlap"]);

export interface RelaxationCandidate {
  /** Stable constraint id, e.g. "compressed-schedule". */
  readonly id: string;
  /** Human-facing label from the constraint. */
  readonly label: string;
}

export type RelaxationOutcome =
  /** No relaxation tried because a timetable already exists. */
  | { kind: "schedulable" }
  /** Removing one of these single constraints would unblock a timetable. */
  | { kind: "single_blockers"; blockers: RelaxationCandidate[] }
  /**
   * No single relaxation unblocks, but removing ALL user constraints does — the
   * blockage is a combination of filters.
   */
  | { kind: "combined_blockers"; relaxable: RelaxationCandidate[] }
  /**
   * Even with every user constraint removed there is still no clash-free
   * timetable: the courses themselves conflict (structural).
   */
  | { kind: "structural_conflict" };

interface RelaxationInput {
  readonly pinned: readonly string[];
  readonly optional: readonly string[];
  readonly targetCount: number;
  readonly cache: DataCache;
  readonly constraints: GenerationConstraints;
  readonly blacklistedCourses?: readonly string[];
}

function makeCtx(cache: DataCache): ConstraintContext {
  const empty: ReadonlySet<string> = new Set<string>();
  return { cache, completed: empty, prereqEligible: empty };
}

function schedulable(pipeline: ConstraintPipeline, input: RelaxationInput): boolean {
  const ctx = makeCtx(input.cache);
  // A fixed deterministic RNG: existence of a timetable does not depend on the
  // enumeration order, so a stable sequence keeps the diagnostic reproducible.
  let seed = 1;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return (
    firstSubsetArrangement({
      pinned: input.pinned,
      optional: input.optional,
      targetCount: input.targetCount,
      cache: input.cache,
      pipeline,
      ctx,
      rng,
      maxNodes: 100_000,
    }) != null
  );
}

/**
 * Determines, by bounded relaxation, why the given course pool cannot be
 * timetabled and which user constraint(s) are responsible.
 */
export function diagnoseByRelaxation(input: RelaxationInput): RelaxationOutcome {
  const constraintList = buildHardConstraintPipeline(input.constraints, input.blacklistedCourses);
  const full = new ConstraintPipeline(constraintList);

  if (schedulable(full, input)) return { kind: "schedulable" };

  const relaxable = full.active.filter((c) => !STRUCTURAL_IDS.has(c.id));

  const blockers: RelaxationCandidate[] = [];
  for (const c of relaxable) {
    if (schedulable(full.without(c.id), input)) {
      blockers.push({ id: c.id, label: c.label });
    }
  }
  if (blockers.length > 0) return { kind: "single_blockers", blockers };

  // No single removal helped — try removing every user constraint at once.
  let stripped = full;
  for (const c of relaxable) stripped = stripped.without(c.id);
  if (relaxable.length > 0 && schedulable(stripped, input)) {
    return {
      kind: "combined_blockers",
      relaxable: relaxable.map((c) => ({ id: c.id, label: c.label })),
    };
  }

  return { kind: "structural_conflict" };
}
