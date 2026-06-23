/// Deterministic search budget (combo expansions) for the timetabler. Sized so
/// any realistically satisfiable instance resolves well below it, while bounding
/// the worst case so behaviour is a pure function of the inputs and never depends
/// on the external wall-clock timeout. If the budget is exhausted the solver
/// gives up deterministically (returns `None`).
pub(super) const ARRANGEMENT_NODE_BUDGET: u64 = 5_000_000;

/// Combo-expansion budget for the objective-aware [`best_arrangement`] enumerator.
/// Unlike the first-solution solvers, this one must visit *leaves* to score them,
/// so it cannot prune as aggressively — it enumerates every conflict-free
/// arrangement of the (small, already-selected) final course set and keeps the
/// lexicographic-best. Sized generously so a realistic timetable (≤ ~7 courses,
/// each a handful of section combos) is enumerated EXHAUSTIVELY — which is what
/// makes the #1 optimization priority a hard guarantee whenever the chosen set
/// admits it — while still bounding the pathological cross-product. Returns the
/// best found so far if the budget is hit (best-effort, never worse than the
/// first feasible arrangement).
pub(super) const BEST_ARRANGEMENT_NODE_BUDGET: u64 = 6_000_000;

/// Cap on the number of complete arrangements scored by [`best_arrangement`].
/// Bounds the cost of scoring (each leaf runs the objective scorers) independently
/// of the node budget. Comfortably above the leaf count of any realistic final
/// course set, so typical baskets are scored exhaustively; a pathological set is
/// scored best-effort up to this many arrangements.
pub(super) const BEST_ARRANGEMENT_LEAF_CAP: u64 = 250_000;
