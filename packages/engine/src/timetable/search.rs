use crate::constraints::Constraints;
use crate::model::DataView;
use crate::rng::Rng;
use crate::types::{Enrollment, WeekMask};

use super::budgets::{
    ARRANGEMENT_NODE_BUDGET, BEST_ARRANGEMENT_LEAF_CAP, BEST_ARRANGEMENT_NODE_BUDGET,
};
use super::combos::{build_timetable_course, ScheduleResolver, TimetableCourse};
use super::solver::{allows_enrollment, passes_final, ArrangeSolver};

/// First conflict-free arrangement of a fixed course set, or None.
pub fn first_seeded_arrangement(
    course_codes: &[String],
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<Vec<Enrollment>> {
    let mut courses: Vec<TimetableCourse> = Vec::with_capacity(course_codes.len());
    for code in course_codes {
        let tc = build_timetable_course(code, data, resolver, constraints, rng)?;
        courses.push(tc);
    }
    let refs: Vec<&TimetableCourse> = courses.iter().collect();
    super::arrange_prebuilt(&refs, constraints, data)
}

/// First conflict-free arrangement of a set of *prebuilt* courses (section combos
/// already computed), or None. Shares the forward-checking + MRV solver with
/// [`first_seeded_arrangement`]; used by feasibility-driven selection where the
/// same courses' combos are probed many times and rebuilding them per probe would
/// be wasteful (and would perturb the seeded RNG stream).
pub fn arrange_prebuilt(
    courses: &[&TimetableCourse],
    constraints: &Constraints,
    data: &DataView,
) -> Option<Vec<Enrollment>> {
    arrange_prebuilt_with_budget(courses, constraints, data, ARRANGEMENT_NODE_BUDGET)
}

/// Like [`arrange_prebuilt`] but with a caller-chosen node budget. Feasibility-
/// driven *selection* probes this many times over a growing set, so it uses a
/// much tighter budget than the one-shot full solve: a rearrangement that needs
/// a deep search is unlikely to pay off versus simply trying another candidate
/// or restart, and an unbounded probe is what made worst-case selection blow up.
pub fn arrange_prebuilt_with_budget(
    courses: &[&TimetableCourse],
    constraints: &Constraints,
    data: &DataView,
    node_budget: u64,
) -> Option<Vec<Enrollment>> {
    // Stable secondary ordering by domain size keeps the MRV tie-break deterministic.
    let mut ordered: Vec<&TimetableCourse> = courses.to_vec();
    ordered.sort_by_key(|c| c.combos.len());

    let mut domains: Vec<Vec<usize>> = ordered
        .iter()
        .map(|c| (0..c.combos.len()).collect())
        .collect();
    let mut solver = ArrangeSolver::with_budget(&ordered, constraints, data, node_budget);
    if solver.solve(&mut domains, 0) {
        let chosen: Vec<Enrollment> = (0..ordered.len())
            .map(|i| ordered[i].combos[solver.assigned[i].expect("complete assignment")].clone())
            .collect();
        Some(chosen)
    } else {
        None
    }
}

/// Objective-aware bounded-exhaustive enumerator over a *prebuilt* fixed course
/// set: visits every conflict-free arrangement (one section combo per course) and
/// returns the one that maximizes the caller's lexicographic objective comparator
/// (`better`), scoring each complete arrangement with `score`.
///
/// Where [`arrange_prebuilt`] returns the *first* feasible arrangement (objective-
/// blind), this returns the *best* one — which is what makes timetable-shape
/// objectives (good breaks / free days / compact) actually honored: because the
/// comparator is quantized-lexicographic, an arrangement with a strictly better
/// #1 score always wins, so the top-priority objective is satisfied whenever the
/// chosen course set admits it.
///
/// Combos are visited in their incoming (seeded) order and ties are *not* taken
/// (`better` is strict), so the first arrangement among equal-best is kept —
/// preserving per-seed variety exactly like the first-solution solvers. Bounded
/// by `node_budget` (combo expansions) and `leaf_cap` (arrangements scored);
/// returns the best found so far if either is exhausted (best-effort, never worse
/// than the first feasible arrangement).
pub fn best_arrangement(
    courses: &[&TimetableCourse],
    constraints: &Constraints,
    data: &DataView,
    score: &dyn Fn(&[Enrollment]) -> Vec<f64>,
    better: &dyn Fn(&[f64], &[f64]) -> bool,
    node_budget: u64,
    leaf_cap: u64,
) -> Option<Vec<Enrollment>> {
    // Smallest domains first: prunes infeasible branches earliest, shrinking the
    // enumerated tree. Deterministic (stable) so the seeded combo order within a
    // course still decides ties.
    let mut ordered: Vec<&TimetableCourse> = courses.to_vec();
    ordered.sort_by_key(|c| c.combos.len());

    let mut search = BestArrange {
        courses: &ordered,
        constraints,
        data,
        score,
        better,
        budget: node_budget,
        leaves: leaf_cap,
        best: None,
    };
    let mut partial: Vec<Enrollment> = Vec::with_capacity(ordered.len());
    search.rec(0, &mut partial, &WeekMask::EMPTY);
    search.best.map(|(_, arr)| arr)
}

/// Like [`best_arrangement`] but resolves `course_codes` to their seeded combos
/// first (mirrors [`first_seeded_arrangement`]). Returns None if any course has
/// no buildable combos, or no conflict-free arrangement exists.
#[allow(clippy::too_many_arguments)]
pub fn best_seeded_arrangement(
    course_codes: &[String],
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
    score: &dyn Fn(&[Enrollment]) -> Vec<f64>,
    better: &dyn Fn(&[f64], &[f64]) -> bool,
) -> Option<Vec<Enrollment>> {
    let mut courses: Vec<TimetableCourse> = Vec::with_capacity(course_codes.len());
    for code in course_codes {
        courses.push(build_timetable_course(
            code,
            data,
            resolver,
            constraints,
            rng,
        )?);
    }
    let refs: Vec<&TimetableCourse> = courses.iter().collect();
    best_arrangement(
        &refs,
        constraints,
        data,
        score,
        better,
        BEST_ARRANGEMENT_NODE_BUDGET,
        BEST_ARRANGEMENT_LEAF_CAP,
    )
}

struct BestArrange<'a> {
    courses: &'a [&'a TimetableCourse],
    constraints: &'a Constraints,
    data: &'a DataView,
    score: &'a dyn Fn(&[Enrollment]) -> Vec<f64>,
    better: &'a dyn Fn(&[f64], &[f64]) -> bool,
    budget: u64,
    leaves: u64,
    best: Option<(Vec<f64>, Vec<Enrollment>)>,
}

impl BestArrange<'_> {
    /// Depth-first enumeration. Returns `false` once a budget is exhausted so the
    /// caller unwinds and keeps the best found so far.
    fn rec(&mut self, idx: usize, partial: &mut Vec<Enrollment>, mask: &WeekMask) -> bool {
        if idx == self.courses.len() {
            if self.leaves == 0 {
                return false;
            }
            self.leaves -= 1;
            if passes_final(partial, self.constraints, self.data) {
                let scores = (self.score)(partial);
                let take = match &self.best {
                    None => true,
                    Some((best_scores, _)) => (self.better)(&scores, best_scores),
                };
                if take {
                    self.best = Some((scores, partial.clone()));
                }
            }
            return self.leaves > 0;
        }
        for combo in &self.courses[idx].combos {
            if self.budget == 0 {
                return false;
            }
            self.budget -= 1;
            let fits = if combo.mask.intersects(mask) {
                allows_enrollment(combo, partial)
            } else {
                true
            };
            if !fits {
                continue;
            }
            let mut next_mask = *mask;
            next_mask.union_with(&combo.mask);
            partial.push(combo.clone());
            let keep_going = self.rec(idx + 1, partial, &next_mask);
            partial.pop();
            if !keep_going {
                return false;
            }
        }
        true
    }
}
