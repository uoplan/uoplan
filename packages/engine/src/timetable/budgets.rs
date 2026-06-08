/// Deterministic search budget (combo expansions) for the timetabler. Sized so
/// any realistically satisfiable instance resolves well below it, while bounding
/// the worst case so behaviour is a pure function of the inputs and never depends
/// on the external wall-clock timeout. If the budget is exhausted the solver
/// gives up deterministically (returns `None`).
pub(super) const ARRANGEMENT_NODE_BUDGET: u64 = 5_000_000;

/// Work-unit budget for the basic-mode randomized-restart greedy fill (see
/// `first_seeded_subset_arrangement`). Charged by *actual overlap work* — every
/// combo scanned costs `placed + 1` units, an overlap scan being O(placed) — so
/// it is a true wall-clock bound regardless of how large or permissive the
/// optional pool is, rather than a node count that hides O(pool) work per node.
/// Sized so any realistically packable request resolves far below it (the
/// term-2271 23-elective repro tops out at ~5M work units across 64 seeds, a
/// >10x margin) while an infeasible request — which always consumes the whole
/// budget — fails fast and deterministically for every seed. Kept well under
/// `advanced.rs`'s `SELECTION_GLOBAL_WORK_BUDGET` so the infeasible worst case
/// stays comfortably below the 3 s worker termination even as WASM (~1.5-2x this
/// native build) on slow CI hardware, where 200M measured ~2.3 s natively
/// (≈4 s WASM).
pub(super) const SUBSET_WORK_BUDGET: u64 = 60_000_000;
