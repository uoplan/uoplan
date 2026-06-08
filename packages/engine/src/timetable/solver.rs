use crate::constraints::Constraints;
use crate::model::DataView;
use crate::types::{enrollments_overlap, Enrollment};

#[cfg(test)]
use super::budgets::ARRANGEMENT_NODE_BUDGET;
use super::combos::TimetableCourse;

pub(crate) fn passes_final(
    chosen: &[Enrollment],
    constraints: &Constraints,
    data: &DataView,
) -> bool {
    constraints.allows_final(chosen, data)
}

pub(crate) fn allows_enrollment(candidate: &Enrollment, partial: &[Enrollment]) -> bool {
    !partial.iter().any(|e| enrollments_overlap(e, candidate))
}

/// Forward-checking + MRV backtracking solver over a fixed set of courses. Each
/// course's domain is its list of seeded-ordered valid section combos; the solver
/// branches on the unassigned course with the fewest remaining compatible combos
/// (most-constrained-variable heuristic) and, after each assignment, prunes every
/// other unassigned course's domain to combos that don't overlap the partial
/// assignment. An empty domain fails the branch immediately, which turns the old
/// chronological thrashing into near-linear search for satisfiable instances —
/// so a valid arrangement is found whenever one exists, independent of seed.
pub(super) struct ArrangeSolver<'a> {
    courses: &'a [&'a TimetableCourse],
    constraints: &'a Constraints,
    data: &'a DataView,
    /// Chosen combo index per course (`None` while unassigned).
    pub(super) assigned: Vec<Option<usize>>,
    /// Remaining search budget; decremented per combo expansion.
    budget: u64,
    /// Budget the solver started with (for `expansions()` diagnostics).
    #[cfg(test)]
    start_budget: u64,
}

impl<'a> ArrangeSolver<'a> {
    #[cfg(test)]
    pub(super) fn new(
        courses: &'a [&'a TimetableCourse],
        constraints: &'a Constraints,
        data: &'a DataView,
    ) -> Self {
        Self::with_budget(courses, constraints, data, ARRANGEMENT_NODE_BUDGET)
    }

    pub(super) fn with_budget(
        courses: &'a [&'a TimetableCourse],
        constraints: &'a Constraints,
        data: &'a DataView,
        budget: u64,
    ) -> Self {
        ArrangeSolver {
            assigned: vec![None; courses.len()],
            courses,
            constraints,
            data,
            budget,
            #[cfg(test)]
            start_budget: budget,
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
    pub(super) fn expansions(&self) -> u64 {
        self.start_budget - self.budget
    }

    fn forward_check(
        &self,
        domains: &mut [Vec<usize>],
        var: usize,
        ci: usize,
    ) -> (Vec<(usize, Vec<usize>)>, bool) {
        let mut removals: Vec<(usize, Vec<usize>)> = Vec::new();
        for j in 0..self.courses.len() {
            if j == var || self.assigned[j].is_some() {
                continue;
            }
            let mut removed: Vec<usize> = Vec::new();
            let courses = self.courses;
            domains[j].retain(|&cj| {
                let keep = !enrollments_overlap(&courses[var].combos[ci], &courses[j].combos[cj]);
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
                return (removals, true);
            }
        }
        (removals, false)
    }

    fn restore_domains(domains: &mut [Vec<usize>], removals: Vec<(usize, Vec<usize>)>) {
        for (j, removed) in removals {
            domains[j].extend(removed);
            domains[j].sort_unstable();
        }
    }

    pub(super) fn solve(&mut self, domains: &mut [Vec<usize>], assigned_count: usize) -> bool {
        if assigned_count == self.courses.len() {
            return self.current_passes_final();
        }
        let Some(var) = self.select_var(domains) else {
            return false;
        };
        let candidates = domains[var].clone();
        for ci in candidates {
            if self.budget == 0 {
                return false;
            }
            self.budget -= 1;
            self.assigned[var] = Some(ci);

            let (removals, wipeout) = self.forward_check(domains, var, ci);
            let solved = !wipeout && self.solve(domains, assigned_count + 1);
            Self::restore_domains(domains, removals);
            if solved {
                return true;
            }
            self.assigned[var] = None;
        }
        false
    }
}
