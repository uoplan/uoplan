//! Seeded timetabling: per-course lazy section combos, fixed-set arrangement
//! enumeration and subset (pinned + fill) enumeration. Ports
//! `engine/timetable/{lazyCombos,enumerator,subsetEnumerator}.ts` and
//! `engine/integration.ts`.

use std::collections::BTreeMap;

use crate::constraints::Constraints;
use crate::model::DataView;
use crate::rng::{shuffle_in_place, Rng};
use crate::types::{
    collect_times, has_internal_overlap, section_has_times, enrollments_overlap, Enrollment,
    RtSchedule, RtSection,
};

/// Whether the schedule has at least one conflict-free section combo under the
/// constraints. Mirrors `getValidSectionCombos(...).length > 0`.
pub fn has_valid_section_combos(schedule: &RtSchedule, constraints: &Constraints) -> bool {
    let mut section_arrays: Vec<Vec<&RtSection>> = Vec::new();
    for sections in schedule.components.values() {
        let filtered: Vec<&RtSection> = sections
            .iter()
            .filter(|s| section_has_times(s) && constraints.allows_section(s))
            .collect();
        if filtered.is_empty() {
            return false;
        }
        section_arrays.push(filtered);
    }

    fn search<'a>(idx: usize, arrays: &[Vec<&'a RtSection>], acc: &mut Vec<&'a RtSection>) -> bool {
        if idx == arrays.len() {
            return true;
        }
        for sec in &arrays[idx] {
            acc.push(sec);
            let times = collect_times(acc);
            if !has_internal_overlap(&times) && search(idx + 1, arrays, acc) {
                acc.pop();
                return true;
            }
            acc.pop();
        }
        false
    }

    let mut acc: Vec<&RtSection> = Vec::new();
    search(0, &section_arrays, &mut acc)
}

/// A course with its precomputed (seeded-ordered) valid section combos.
pub struct TimetableCourse {
    #[allow(dead_code)]
    pub code: String,
    pub combos: Vec<Enrollment>,
}

/// Resolves a course code to its effective schedule (already closed/virtual
/// filtered as appropriate for the caller).
pub trait ScheduleResolver {
    fn resolve(&self, code: &str) -> Option<RtSchedule>;
}

/// Generic resolver driven by an `include_closed` flag and a per-course
/// "virtual only" predicate (mirrors `cacheWithPerCourseVirtualFilter`).
pub struct FnResolver<'a, F: Fn(&str) -> bool> {
    pub data: &'a DataView,
    pub include_closed: bool,
    pub virtual_for: F,
}

impl<'a, F: Fn(&str) -> bool> ScheduleResolver for FnResolver<'a, F> {
    fn resolve(&self, code: &str) -> Option<RtSchedule> {
        self.data
            .effective_schedule(code, self.include_closed, (self.virtual_for)(code))
    }
}

/// Builds the seeded combos for one course. Honours projects yield a single
/// empty (timeless) combo. Returns None if the course cannot be scheduled.
pub fn build_timetable_course(
    code: &str,
    data: &DataView,
    resolver: &dyn ScheduleResolver,
    constraints: &Constraints,
    rng: &mut Rng,
) -> Option<TimetableCourse> {
    if data.is_honours_project(code) {
        return Some(TimetableCourse {
            code: data.canonical_code_str(code),
            combos: vec![Enrollment {
                course_code: data.canonical_code_str(code),
                sections: BTreeMap::new(),
                times: Vec::new(),
            }],
        });
    }

    let schedule = resolver.resolve(code)?;
    let component_keys: Vec<String> = schedule.components.keys().cloned().collect();
    let mut section_arrays: Vec<Vec<RtSection>> = Vec::with_capacity(component_keys.len());
    for key in &component_keys {
        let sections = schedule.components.get(key).unwrap();
        let mut filtered: Vec<RtSection> = sections
            .iter()
            .filter(|s| section_has_times(s) && constraints.allows_section(s))
            .cloned()
            .collect();
        if filtered.is_empty() {
            return None;
        }
        shuffle_in_place(&mut filtered, rng);
        section_arrays.push(filtered);
    }

    let total: usize = section_arrays.iter().map(|a| a.len()).product();
    let mut combos: Vec<Enrollment> = Vec::new();
    let mut indices = vec![0usize; section_arrays.len()];
    for _ in 0..total {
        let chosen: Vec<&RtSection> = section_arrays
            .iter()
            .enumerate()
            .map(|(i, arr)| &arr[indices[i]])
            .collect();
        let times = collect_times(&chosen);
        if !has_internal_overlap(&times) {
            let mut sections = BTreeMap::new();
            for (i, key) in component_keys.iter().enumerate() {
                sections.insert(key.clone(), chosen[i].section.clone());
            }
            combos.push(Enrollment {
                course_code: schedule.course_code.clone(),
                sections,
                times,
            });
        }
        // advance odometer
        for i in (0..section_arrays.len()).rev() {
            indices[i] += 1;
            if indices[i] < section_arrays[i].len() {
                break;
            }
            indices[i] = 0;
        }
    }

    if combos.is_empty() {
        None
    } else {
        Some(TimetableCourse {
            code: data.canonical_code_str(code),
            combos,
        })
    }
}

pub(crate) fn passes_final(chosen: &[Enrollment], constraints: &Constraints, data: &DataView) -> bool {
    let codes_times: Vec<(String, Vec<_>)> = chosen
        .iter()
        .map(|e| (e.course_code.clone(), e.times.clone()))
        .collect();
    constraints.allows_final(&codes_times, data)
}

pub(crate) fn allows_enrollment(candidate: &Enrollment, partial: &[Enrollment]) -> bool {
    !partial.iter().any(|e| enrollments_overlap(e, candidate))
}

/// Deterministic search budget (combo expansions) for the timetabler. Sized so
/// any realistically satisfiable instance resolves well below it, while bounding
/// the worst case so behaviour is a pure function of the inputs and never depends
/// on the external wall-clock timeout. If the budget is exhausted the solver
/// gives up deterministically (returns `None`).
const ARRANGEMENT_NODE_BUDGET: u64 = 5_000_000;

/// Forward-checking + MRV backtracking solver over a fixed set of courses. Each
/// course's domain is its list of seeded-ordered valid section combos; the solver
/// branches on the unassigned course with the fewest remaining compatible combos
/// (most-constrained-variable heuristic) and, after each assignment, prunes every
/// other unassigned course's domain to combos that don't overlap the partial
/// assignment. An empty domain fails the branch immediately, which turns the old
/// chronological thrashing into near-linear search for satisfiable instances —
/// so a valid arrangement is found whenever one exists, independent of seed.
struct ArrangeSolver<'a> {
    courses: &'a [&'a TimetableCourse],
    constraints: &'a Constraints,
    data: &'a DataView,
    /// Chosen combo index per course (`None` while unassigned).
    assigned: Vec<Option<usize>>,
    /// Remaining search budget; decremented per combo expansion.
    budget: u64,
}

impl<'a> ArrangeSolver<'a> {
    fn new(
        courses: &'a [&'a TimetableCourse],
        constraints: &'a Constraints,
        data: &'a DataView,
    ) -> Self {
        ArrangeSolver {
            assigned: vec![None; courses.len()],
            courses,
            constraints,
            data,
            budget: ARRANGEMENT_NODE_BUDGET,
        }
    }

    /// MRV: the unassigned course with the smallest current domain. Ties break by
    /// the (deterministic) course index so the search order is reproducible.
    fn select_var(&self, domains: &[Vec<usize>]) -> Option<usize> {
        let mut best: Option<usize> = None;
        let mut best_len = usize::MAX;
        for j in 0..self.courses.len() {
            if self.assigned[j].is_some() {
                continue;
            }
            let len = domains[j].len();
            if len < best_len {
                best_len = len;
                best = Some(j);
                if len == 0 {
                    break;
                }
            }
        }
        best
    }

    fn current_passes_final(&self) -> bool {
        let chosen: Vec<Enrollment> = (0..self.courses.len())
            .map(|i| self.courses[i].combos[self.assigned[i].expect("complete assignment")].clone())
            .collect();
        passes_final(&chosen, self.constraints, self.data)
    }

    /// Number of combo expansions consumed so far (for tests/diagnostics): a
    /// direct measure of search effort. Near-linear in the course count for
    /// satisfiable instances; an exponential blow-up here is the bug this design
    /// prevents.
    #[cfg(test)]
    fn expansions(&self) -> u64 {
        ARRANGEMENT_NODE_BUDGET - self.budget
    }

    fn solve(&mut self, domains: &mut [Vec<usize>], assigned_count: usize) -> bool {
        if assigned_count == self.courses.len() {
            return self.current_passes_final();
        }
        let Some(var) = self.select_var(domains) else {
            return false;
        };
        // Iterate the domain in its (seeded) combo order. Clone so we can mutate
        // the other courses' domains during forward checking.
        let candidates = domains[var].clone();
        for ci in candidates {
            if self.budget == 0 {
                return false;
            }
            self.budget -= 1;

            self.assigned[var] = Some(ci);

            // Forward check: prune every other unassigned course to combos that
            // remain conflict-free with this assignment. Record removals to undo.
            let mut removals: Vec<(usize, Vec<usize>)> = Vec::new();
            let mut wipeout = false;
            for j in 0..self.courses.len() {
                if j == var || self.assigned[j].is_some() {
                    continue;
                }
                let mut removed: Vec<usize> = Vec::new();
                let courses = self.courses;
                domains[j].retain(|&cj| {
                    let keep =
                        !enrollments_overlap(&courses[var].combos[ci], &courses[j].combos[cj]);
                    if !keep {
                        removed.push(cj);
                    }
                    keep
                });
                let emptied = domains[j].is_empty();
                if !removed.is_empty() {
                    removals.push((j, removed));
                }
                if emptied {
                    wipeout = true;
                    break;
                }
            }

            if !wipeout && self.solve(domains, assigned_count + 1) {
                return true;
            }

            // Undo forward-checking removals, restoring seeded (ascending-index) order.
            for (j, removed) in removals {
                domains[j].extend(removed);
                domains[j].sort_unstable();
            }
            self.assigned[var] = None;
        }
        false
    }
}

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
    arrange_prebuilt(&refs, constraints, data)
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
    // Stable secondary ordering by domain size keeps the MRV tie-break deterministic.
    let mut ordered: Vec<&TimetableCourse> = courses.to_vec();
    ordered.sort_by_key(|c| c.combos.len());

    let mut domains: Vec<Vec<usize>> =
        ordered.iter().map(|c| (0..c.combos.len()).collect()).collect();
    let mut solver = ArrangeSolver::new(&ordered, constraints, data);
    if solver.solve(&mut domains, 0) {
        let chosen: Vec<Enrollment> = (0..ordered.len())
            .map(|i| ordered[i].combos[solver.assigned[i].expect("complete assignment")].clone())
            .collect();
        Some(chosen)
    } else {
        None
    }
}

fn arrangement_fingerprint(chosen: &[Enrollment]) -> String {
    let mut parts: Vec<String> = chosen
        .iter()
        .map(|e| {
            let sections: Vec<String> = e
                .sections
                .iter()
                .map(|(k, v)| format!("{k}:{v}"))
                .collect();
            format!("{}{{{}}}", e.course_code, sections.join("|"))
        })
        .collect();
    parts.sort();
    parts.join(",")
}

/// First seeded subset timetable that pins all `pinned` and fills to
/// `target_count` from `optional` (in the given seeded order), or None.
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

    // Most-constrained pinned course first keeps the mandatory backtracking shallow.
    pinned_courses.sort_by_key(|c| c.combos.len());

    let mut chosen: Vec<Enrollment> = Vec::new();
    let slots = target_count - pinned_courses.len();
    let mut budget: u64 = ARRANGEMENT_NODE_BUDGET;

    /// Every remaining (unplaced) pinned course still has at least one combo that
    /// fits the current partial assignment. A cheap forward check that prunes
    /// pinned branches which can no longer be completed.
    fn pinned_feasible(rest: &[TimetableCourse], chosen: &[Enrollment]) -> bool {
        rest.iter()
            .all(|c| c.combos.iter().any(|combo| allows_enrollment(combo, chosen)))
    }

    /// At least `need` of the remaining optional courses (`optional[idx..]`) still
    /// have a combo compatible with the current partial assignment. An admissible
    /// (never over-pruning) forward check: a course with no compatible combo can
    /// never fill a slot, so it cannot count toward the remaining slots.
    fn enough_optional_feasible(
        optional: &[TimetableCourse],
        idx: usize,
        need: usize,
        chosen: &[Enrollment],
    ) -> bool {
        if need == 0 {
            return true;
        }
        let mut count = 0usize;
        for course in &optional[idx..] {
            if course.combos.iter().any(|combo| allows_enrollment(combo, chosen)) {
                count += 1;
                if count >= need {
                    return true;
                }
            }
        }
        false
    }

    fn fill_optional(
        idx: usize,
        slots_left: usize,
        optional: &[TimetableCourse],
        chosen: &mut Vec<Enrollment>,
        constraints: &Constraints,
        data: &DataView,
        budget: &mut u64,
    ) -> bool {
        if slots_left == 0 {
            return passes_final(chosen, constraints, data);
        }
        if *budget == 0 {
            return false;
        }
        // Forward check: prune unless enough remaining optional courses can still
        // each fit the current assignment (subsumes the plain count check).
        if !enough_optional_feasible(optional, idx, slots_left, chosen) {
            return false;
        }
        for combo in &optional[idx].combos {
            if !allows_enrollment(combo, chosen) {
                continue;
            }
            *budget = budget.saturating_sub(1);
            chosen.push(combo.clone());
            if fill_optional(idx + 1, slots_left - 1, optional, chosen, constraints, data, budget) {
                return true;
            }
            chosen.pop();
        }
        fill_optional(idx + 1, slots_left, optional, chosen, constraints, data, budget)
    }

    fn place_pinned(
        idx: usize,
        pinned: &[TimetableCourse],
        optional: &[TimetableCourse],
        slots: usize,
        chosen: &mut Vec<Enrollment>,
        constraints: &Constraints,
        data: &DataView,
        budget: &mut u64,
    ) -> bool {
        if idx == pinned.len() {
            return fill_optional(0, slots, optional, chosen, constraints, data, budget);
        }
        for combo in &pinned[idx].combos {
            if !allows_enrollment(combo, chosen) {
                continue;
            }
            if *budget == 0 {
                return false;
            }
            *budget = budget.saturating_sub(1);
            chosen.push(combo.clone());
            // Forward check: prune unless every remaining pinned course can still fit.
            if pinned_feasible(&pinned[idx + 1..], chosen)
                && place_pinned(idx + 1, pinned, optional, slots, chosen, constraints, data, budget)
            {
                return true;
            }
            chosen.pop();
        }
        false
    }

    if place_pinned(
        0,
        &pinned_courses,
        &optional_courses,
        slots,
        &mut chosen,
        constraints,
        data,
        &mut budget,
    ) {
        let _ = arrangement_fingerprint(&chosen); // dedup not needed for "first"
        Some(chosen)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::data::{Catalogue, SchedulesData};
    use crate::types::RtTime;

    fn t(day: u8, start: u32, end: u32) -> RtTime {
        RtTime { day, start, end, is_virtual: false, instructor: None, dates: None }
    }

    fn enr(code: &str, slots: &[(u8, u32, u32)]) -> Enrollment {
        Enrollment {
            course_code: code.to_string(),
            sections: BTreeMap::new(),
            times: slots.iter().map(|&(d, s, e)| t(d, s, e)).collect(),
        }
    }

    fn course(code: &str, combos: Vec<Enrollment>) -> TimetableCourse {
        TimetableCourse { code: code.to_string(), combos }
    }

    fn default_constraints() -> Constraints {
        Constraints { max_end: 24 * 60, ..Default::default() }
    }

    fn solve_set(courses: &[TimetableCourse]) -> Option<Vec<Enrollment>> {
        solve_set_with_effort(courses).0
    }

    /// Like [`solve_set`] but also returns the number of combo expansions the
    /// solver consumed — a direct, deterministic measure of search effort used to
    /// assert the timetabler stays near-linear (never exponential) regardless of
    /// seed/order.
    fn solve_set_with_effort(courses: &[TimetableCourse]) -> (Option<Vec<Enrollment>>, u64) {
        let data = DataView::new(Catalogue::default(), SchedulesData::default());
        let constraints = default_constraints();
        let ordered: Vec<&TimetableCourse> = courses.iter().collect();
        let mut domains: Vec<Vec<usize>> =
            ordered.iter().map(|c| (0..c.combos.len()).collect()).collect();
        let mut solver = ArrangeSolver::new(&ordered, &constraints, &data);
        let found = solver.solve(&mut domains, 0);
        let effort = solver.expansions();
        let result = found.then(|| {
            (0..ordered.len())
                .map(|i| ordered[i].combos[solver.assigned[i].unwrap()].clone())
                .collect()
        });
        (result, effort)
    }

    fn has_conflict(chosen: &[Enrollment]) -> bool {
        for i in 0..chosen.len() {
            for j in (i + 1)..chosen.len() {
                if enrollments_overlap(&chosen[i], &chosen[j]) {
                    return true;
                }
            }
        }
        false
    }

    // 09-10, 10-11, 11-12 on Monday.
    const S1: (u8, u32, u32) = (0, 540, 600);
    const S2: (u8, u32, u32) = (0, 600, 660);
    const S3: (u8, u32, u32) = (0, 660, 720);

    #[test]
    fn finds_simple_nonconflicting_set() {
        let courses = vec![
            course("A", vec![enr("A", &[S1])]),
            course("B", vec![enr("B", &[S2])]),
            course("C", vec![enr("C", &[S3])]),
        ];
        let sol = solve_set(&courses).expect("a conflict-free arrangement exists");
        assert_eq!(sol.len(), 3);
        assert!(!has_conflict(&sol));
    }

    #[test]
    fn picks_non_first_combo_when_first_conflicts() {
        // B is forced to S2; A lists S2 first (a trap) but also offers S1.
        let courses = vec![
            course("A", vec![enr("A", &[S2]), enr("A", &[S1])]),
            course("B", vec![enr("B", &[S2])]),
        ];
        let sol = solve_set(&courses).expect("solution exists via A's second combo");
        assert_eq!(sol.len(), 2);
        assert!(!has_conflict(&sol));
    }

    #[test]
    fn solves_chain_requiring_forward_checking() {
        // A:[S1,S2] B:[S1] C:[S2,S3]. Only B=S1, A=S2, C=S3 (or A=S2,C=S3) works.
        let courses = vec![
            course("A", vec![enr("A", &[S1]), enr("A", &[S2])]),
            course("B", vec![enr("B", &[S1])]),
            course("C", vec![enr("C", &[S2]), enr("C", &[S3])]),
        ];
        let sol = solve_set(&courses).expect("a satisfying assignment exists");
        assert_eq!(sol.len(), 3);
        assert!(!has_conflict(&sol));
    }

    #[test]
    fn reports_unsatisfiable_set() {
        // Three courses competing for only two slots -> no arrangement.
        let courses = vec![
            course("A", vec![enr("A", &[S1]), enr("A", &[S2])]),
            course("B", vec![enr("B", &[S1]), enr("B", &[S2])]),
            course("C", vec![enr("C", &[S1]), enr("C", &[S2])]),
        ];
        assert!(solve_set(&courses).is_none());
    }

    #[test]
    fn multi_component_overlap_is_respected() {
        // A occupies S1+S3 (two meetings); B can only take S1 or S3 -> must fail,
        // C takes S2 freely. With only A and B it's unsatisfiable.
        let courses = vec![
            course("A", vec![enr("A", &[S1, S3])]),
            course("B", vec![enr("B", &[S1]), enr("B", &[S3])]),
        ];
        assert!(solve_set(&courses).is_none());
    }

    /// Build `n` courses on a weekly grid. Each course offers two combos: a busy
    /// slot shared with the other members of its 4-course group (listed first, so
    /// a naive solver tries it eagerly), then a unique private slot. A valid
    /// assignment always exists (everyone takes their private slot), but the shared
    /// slots create real inter-course contention. Forward checking + MRV must keep
    /// this near-linear instead of exploring the exponential cross-product.
    fn grouped_grid_courses(n: usize) -> Vec<TimetableCourse> {
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            let group = (i / 4) as u8; // 4 courses share a busy slot
            let shared = (group % 5, 540, 600); // each group's shared slot at 09:00
            // Unique private slot: (day, hour) = bijection of i, so no two collide.
            let day = (i % 5) as u8;
            let start = 600 + (i as u32 / 5) * 60;
            let private = (day, start, start + 60);
            out.push(course(
                &format!("C{i}"),
                vec![
                    enr(&format!("C{i}"), &[shared]),
                    enr(&format!("C{i}"), &[private]),
                ],
            ));
        }
        out
    }

    #[test]
    fn large_satisfiable_set_stays_near_linear() {
        const N: usize = 24;
        let courses = grouped_grid_courses(N);
        let (sol, effort) = solve_set_with_effort(&courses);
        let sol = sol.expect("a conflict-free arrangement exists (everyone's private slot)");
        assert_eq!(sol.len(), N);
        assert!(!has_conflict(&sol));
        // Forward checking keeps this within a small multiple of N. A regression to
        // naive chronological backtracking would blow this up exponentially.
        assert!(
            effort <= (N as u64) * 8,
            "expected near-linear search, used {effort} expansions for {N} courses"
        );
    }

    #[test]
    fn proves_overconstrained_unsat_quickly() {
        // Five courses all forced into the same two slots: unsatisfiable, and the
        // solver must prove it without a combinatorial explosion.
        let courses: Vec<TimetableCourse> = (0..5)
            .map(|i| {
                course(&format!("U{i}"), vec![enr(&format!("U{i}"), &[S1]), enr(&format!("U{i}"), &[S2])])
            })
            .collect();
        let (sol, effort) = solve_set_with_effort(&courses);
        assert!(sol.is_none());
        assert!(effort <= 64, "unsat proof should be cheap, used {effort} expansions");
    }
}
