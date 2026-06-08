use crate::constraints::Constraints;
use crate::model::DataView;
use crate::rng::{shuffle_in_place, Rng};
use crate::types::{Enrollment, WeekMask};

use super::budgets::{ARRANGEMENT_NODE_BUDGET, SUBSET_WORK_BUDGET};
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

/// Find the first combo of `course` compatible with the current partial
/// assignment, charging `placed + 1` work units per combo scanned (an overlap
/// scan is O(placed)). `chosen_mask` is the incrementally-maintained union of the
/// chosen enrollments' occupancy masks: a combo whose mask is disjoint from it
/// shares no time slot with anything placed and therefore fits immediately (an
/// exact O(1) accept), so only mask-intersecting combos pay the precise scan.
/// Returns `None` if the budget runs out or nothing fits.
fn first_fit_combo(
    course: &TimetableCourse,
    chosen: &[Enrollment],
    chosen_mask: &WeekMask,
    work: &mut u64,
) -> Option<Enrollment> {
    for combo in &course.combos {
        if *work == 0 {
            return None;
        }
        *work = work.saturating_sub(chosen.len() as u64 + 1);
        let fits = if combo.mask.intersects(chosen_mask) {
            allows_enrollment(combo, chosen)
        } else {
            true
        };
        if fits {
            return Some(combo.clone());
        }
    }
    None
}

/// First seeded subset timetable that pins all `pinned` and fills to
/// `target_count` from `optional`, or None if no conflict-free arrangement is
/// found within the work budget.
///
/// Implemented as a **randomized-restart greedy** with a work-charged global
/// budget (mirroring `advanced.rs`). The previous exhaustive chronological DFS
/// scanned the whole remaining pool at every node and bounded node *count* (not
/// work), so on a permissive pool a single run did billions of overlap checks
/// and most seeds exhausted the budget and returned a *false negative* even when
/// a packing existed — making success depend on the RNG seed. Each restart here
/// reshuffles the placement order and greedily seats a compatible combo per
/// course; charging the budget by real overlap work makes latency a function of
/// the inputs, and the restarts make a feasible packing discoverable for EVERY
/// seed (the seed only reorders which valid schedule is returned first).
#[allow(clippy::too_many_arguments)]
pub fn first_seeded_subset_arrangement(
    pinned: &[String],
    optional: &[String],
    target_count: usize,
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<Vec<Enrollment>> {
    if pinned.len() > target_count {
        return None;
    }

    let mut pinned_courses: Vec<TimetableCourse> = Vec::new();
    for code in pinned {
        let tc = build_timetable_course(code, data, resolver, constraints, rng)?;
        pinned_courses.push(tc);
    }

    let mut optional_courses: Vec<TimetableCourse> = Vec::new();
    for code in optional {
        if pinned.contains(code) {
            continue;
        }
        if let Some(tc) = build_timetable_course(code, data, resolver, constraints, rng) {
            optional_courses.push(tc);
        }
    }

    let slots = target_count - pinned_courses.len();
    if optional_courses.len() < slots {
        return None;
    }

    let mut work: u64 = SUBSET_WORK_BUDGET;
    let mut pinned_order: Vec<usize> = (0..pinned_courses.len()).collect();
    let mut optional_order: Vec<usize> = (0..optional_courses.len()).collect();

    let mut restart = 0u64;
    loop {
        if work == 0 {
            return None;
        }
        // The first attempt keeps the incoming seeded order (per-seed variety);
        // later restarts reshuffle to escape a greedy dead-end.
        if restart > 0 {
            shuffle_in_place(&mut pinned_order, rng);
            shuffle_in_place(&mut optional_order, rng);
        }
        restart += 1;

        let mut chosen: Vec<Enrollment> = Vec::with_capacity(target_count);
        let mut chosen_mask = WeekMask::EMPTY;

        // Seat every pinned course; abandon the restart if one can't be placed.
        let mut pinned_ok = true;
        for &pi in &pinned_order {
            if let Some(combo) =
                first_fit_combo(&pinned_courses[pi], &chosen, &chosen_mask, &mut work)
            {
                chosen_mask.union_with(&combo.mask);
                chosen.push(combo);
            } else {
                if work == 0 {
                    return None;
                }
                pinned_ok = false;
                break;
            }
        }
        if !pinned_ok {
            continue;
        }

        // Greedily fill the remaining slots from the optional pool.
        let mut filled = 0usize;
        for &oi in &optional_order {
            if filled == slots {
                break;
            }
            if work == 0 {
                return None;
            }
            if let Some(combo) =
                first_fit_combo(&optional_courses[oi], &chosen, &chosen_mask, &mut work)
            {
                chosen_mask.union_with(&combo.mask);
                chosen.push(combo);
                filled += 1;
            }
        }

        if filled == slots && passes_final(&chosen, constraints, data) {
            return Some(chosen);
        }
        // Otherwise reshuffle and retry until the work budget is exhausted.
    }
}
