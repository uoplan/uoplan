use super::search::best_arrangement;
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

// --- build_timetable_course: timeless (no-meeting-time) courses ---------------

/// Builds a `DataView` where each course maps to a list of components, each with
/// a single section carrying the given (start, end) meeting times on Monday. An
/// empty time slice makes that section (hence the course) timeless.
fn data_with_schedules(courses: &[(&str, &[(&str, &[(u32, u32)])])]) -> DataView {
    use crate::proto::data::{
        Catalogue, ComponentSection, ComponentSectionList, Course, CourseSchedule, DayOfWeek,
        MeetingTime, SchedulesData, SectionStatus,
    };
    let course_codes: Vec<String> = courses.iter().map(|(c, _)| (*c).to_string()).collect();
    let cat_courses: Vec<Course> = (0..courses.len())
        .map(|i| Course {
            code: i as u32,
            credits: 3.0,
            ..Default::default()
        })
        .collect();
    let schedules: Vec<CourseSchedule> = courses
        .iter()
        .enumerate()
        .map(|(i, (_, comps))| {
            let mut components = std::collections::HashMap::new();
            for (key, slots) in comps.iter() {
                let times: Vec<MeetingTime> = slots
                    .iter()
                    .map(|&(start, end)| MeetingTime {
                        day: DayOfWeek::Mo as i32,
                        start_minutes: start,
                        end_minutes: end,
                        ..Default::default()
                    })
                    .collect();
                components.insert(
                    (*key).to_string(),
                    ComponentSectionList {
                        items: vec![ComponentSection {
                            section: "A".to_string(),
                            times,
                            status: SectionStatus::Open as i32,
                            ..Default::default()
                        }],
                    },
                );
            }
            CourseSchedule {
                course: i as u32,
                components,
                ..Default::default()
            }
        })
        .collect();

    DataView::new(
        Catalogue {
            course_codes: course_codes.clone(),
            courses: cat_courses,
            ..Default::default()
        },
        SchedulesData {
            course_codes,
            schedules,
            ..Default::default()
        },
    )
}

#[test]
fn timeless_course_with_empty_times_builds_single_empty_combo() {
    // A non-"900" course whose only section carries no meeting time (e.g. an STG
    // placement / thesis / co-op) must be schedulable as a single timeless combo
    // instead of returning None (which would make any schedule containing it
    // unbuildable).
    let data = data_with_schedules(&[("ADM 3996", &[("STG", &[])])]);
    let constraints = crate::constraints::Constraints {
        max_end: 24 * 60,
        ..Default::default()
    };
    let resolver = FnResolver {
        data: &data,
        include_closed: true,
        virtual_for: |_| false,
    };
    let mut rng = crate::rng::Rng::new(1);

    assert!(data.is_timeless_course("ADM 3996"));
    assert!(!data.is_honours_project("ADM 3996"));
    let tc = build_timetable_course("ADM 3996", &data, &resolver, &constraints, &mut rng)
        .expect("timeless course should build a combo");
    assert_eq!(tc.combos.len(), 1);
    assert!(tc.combos[0].times.is_empty());
}

#[test]
fn honours_course_with_stray_time_stays_timeless() {
    // A "900" honours/research course must stay timeless even when the registrar
    // lists a stray meeting time. Forcing it onto the timetable (scheduling it
    // with real times) could make an otherwise feasible schedule unbuildable —
    // this is the regression guard for the committed term-2271 elective pool.
    let data = data_with_schedules(&[("PHY 4900", &[("SEM", &[(540, 600)])])]);
    let constraints = crate::constraints::Constraints {
        max_end: 24 * 60,
        ..Default::default()
    };
    let resolver = FnResolver {
        data: &data,
        include_closed: true,
        virtual_for: |_| false,
    };
    let mut rng = crate::rng::Rng::new(1);

    assert!(data.is_honours_project("PHY 4900"));
    assert!(data.is_timeless_course("PHY 4900"));
    let tc = build_timetable_course("PHY 4900", &data, &resolver, &constraints, &mut rng)
        .expect("honours course should build a combo");
    assert_eq!(tc.combos.len(), 1);
    assert!(
        tc.combos[0].times.is_empty(),
        "honours course must not occupy a timetable slot"
    );
}

#[test]
fn non_honours_course_missing_from_schedule_is_not_timeless() {
    let data = data_with_schedules(&[("CSI 2101", &[("LEC", &[(540, 600)])])]);
    // A non-honours code with no schedule entry is NOT timeless — it keeps
    // failing the normal resolve path rather than becoming a silent free pick.
    assert!(!data.is_timeless_course("PHI 1234"));
}

#[test]
fn course_with_real_times_is_not_timeless_and_builds_real_combos() {
    let data = data_with_schedules(&[("CSI 2101", &[("LEC", &[(540, 600)])])]);
    let constraints = crate::constraints::Constraints {
        max_end: 24 * 60,
        ..Default::default()
    };
    let resolver = FnResolver {
        data: &data,
        include_closed: true,
        virtual_for: |_| false,
    };
    let mut rng = crate::rng::Rng::new(1);

    assert!(!data.is_timeless_course("CSI 2101"));
    let tc = build_timetable_course("CSI 2101", &data, &resolver, &constraints, &mut rng)
        .expect("timed course should build a combo");
    assert_eq!(tc.combos.len(), 1);
    assert_eq!(tc.combos[0].times.len(), 1);
}

// --- best_arrangement: objective-aware fixed-set timetabling -----------------

/// Total minutes of idle gaps within a single day across the chosen enrollments
/// (a tiny stand-in for the real "good breaks"/compact objectives). Lower = more
/// compact; the test scorer turns it into a higher-is-better score.
fn idle_minutes(chosen: &[Enrollment]) -> u32 {
    let mut slots: Vec<(u32, u32)> = chosen
        .iter()
        .flat_map(|e| e.times.iter().map(|t| (t.start, t.end)))
        .collect();
    slots.sort_unstable();
    if slots.is_empty() {
        return 0;
    }
    let span = slots.last().unwrap().1 - slots[0].0;
    let busy: u32 = slots.iter().map(|(s, e)| e - s).sum();
    span - busy
}

fn compact_score(chosen: &[Enrollment]) -> Vec<f64> {
    vec![1.0 / (1.0 + f64::from(idle_minutes(chosen)))]
}

fn strictly_greater(a: &[f64], b: &[f64]) -> bool {
    a.first().copied().unwrap_or(0.0) > b.first().copied().unwrap_or(0.0) + 1e-9
}

fn best(courses: &[TimetableCourse]) -> Option<Vec<Enrollment>> {
    let data = DataView::new(Catalogue::default(), SchedulesData::default());
    let constraints = default_constraints();
    let refs: Vec<&TimetableCourse> = courses.iter().collect();
    best_arrangement(
        &refs,
        &constraints,
        &data,
        &compact_score,
        &strictly_greater,
        1_000_000,
        100_000,
    )
}

#[test]
fn best_arrangement_picks_zero_gap_over_long_gap() {
    // B is fixed to 10-11. A can sit at 09-10 (back-to-back with B, zero gap) or
    // at 13-14 (a 2h gap after B). A first-solution solver would take whichever
    // combo is listed first; best_arrangement must pick the zero-gap one even
    // though the long-gap combo is listed first.
    const A_EARLY: (u8, u32, u32) = (0, 540, 600); // 09-10
    const A_LATE: (u8, u32, u32) = (0, 780, 840); // 13-14
    let courses = vec![
        course("A", vec![enr("A", &[A_LATE]), enr("A", &[A_EARLY])]),
        course("B", vec![enr("B", &[S2])]), // 10-11
    ];
    let sol = best(&courses).expect("a conflict-free arrangement exists");
    assert_eq!(sol.len(), 2);
    assert!(!has_conflict(&sol));
    assert_eq!(
        idle_minutes(&sol),
        0,
        "best_arrangement should choose the back-to-back (zero-gap) arrangement"
    );
}

#[test]
fn best_arrangement_returns_none_when_unsatisfiable() {
    // Three courses all competing for the same two slots: no arrangement exists.
    let courses = vec![
        course("A", vec![enr("A", &[S1]), enr("A", &[S2])]),
        course("B", vec![enr("B", &[S1]), enr("B", &[S2])]),
        course("C", vec![enr("C", &[S1]), enr("C", &[S2])]),
    ];
    assert!(best(&courses).is_none());
}

#[test]
fn best_arrangement_keeps_first_among_tied() {
    // Two equally-good (zero-gap) arrangements exist; the first one enumerated
    // (seeded combo order) must be kept so per-seed variety is preserved.
    let courses = vec![
        course("A", vec![enr("A", &[S1]), enr("A", &[S3])]),
        course("B", vec![enr("B", &[S2])]),
    ];
    let sol = best(&courses).expect("a conflict-free arrangement exists");
    assert_eq!(sol.len(), 2);
    let a = sol.iter().find(|e| e.course_code == "A").unwrap();
    assert_eq!(
        a.times[0].start, S1.1,
        "first-among-tied combo should be kept"
    );
}
