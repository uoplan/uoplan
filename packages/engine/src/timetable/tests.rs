use super::solver::ArrangeSolver;
use super::*;
use std::collections::BTreeMap;

use crate::constraints::Constraints;
use crate::model::DataView;
use crate::proto::data::{Catalogue, SchedulesData};
use crate::types::{enrollments_overlap, Enrollment, RtTime};

fn t(day: u8, start: u32, end: u32) -> RtTime {
    RtTime {
        day,
        start,
        end,
        is_virtual: false,
        instructor: None,
        dates: None,
    }
}

fn enr(code: &str, slots: &[(u8, u32, u32)]) -> Enrollment {
    let times: Vec<RtTime> = slots.iter().map(|&(d, s, e)| t(d, s, e)).collect();
    Enrollment {
        course_code: code.to_string(),
        sections: BTreeMap::new(),
        mask: crate::types::WeekMask::from_times(&times),
        times,
    }
}

fn course(_code: &str, combos: Vec<Enrollment>) -> TimetableCourse {
    TimetableCourse { combos }
}

fn default_constraints() -> Constraints {
    Constraints {
        max_end: 24 * 60,
        ..Default::default()
    }
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
    let mut domains: Vec<Vec<usize>> = ordered
        .iter()
        .map(|c| (0..c.combos.len()).collect())
        .collect();
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
            course(
                &format!("U{i}"),
                vec![enr(&format!("U{i}"), &[S1]), enr(&format!("U{i}"), &[S2])],
            )
        })
        .collect();
    let (sol, effort) = solve_set_with_effort(&courses);
    assert!(sol.is_none());
    assert!(
        effort <= 64,
        "unsat proof should be cheap, used {effort} expansions"
    );
}
