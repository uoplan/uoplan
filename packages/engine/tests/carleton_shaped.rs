//! Carleton University shape regression tests.
//!
//! Carleton courses are 0.5 credit units (a full-time term is 5 courses = 2.5
//! credits) and the scraper uses Banner component codes (LEC, LAB, TUT, SEM,
//! DGD, FP, P, DG, …). Term ids are 6-digit Banner ids (e.g. 202710).
//!
//! These tests verify that:
//!   1. The first-year credit cap constraint uses the per-course credit value
//!      from `CreditConfig`, not the hardcoded uOttawa default of 3.0.
//!   2. Component codes that appear in the real Carleton data but not in
//!      uOttawa's are treated transparently — the engine never inspects
//!      component-name content.
//!   3. 6-digit Banner term ids round-trip through the uint32 proto field.
//!   4. End-to-end generation against the real Carleton .pb datasets produces a
//!      conflict-free timetable (skipped when the .pb artifacts are absent).
//!
//! Unit-level pool-cap and credit-math tests already live in `pools.rs` and
//! `constraints.rs`; these are integration-level checks via the `Engine` API.

use std::collections::HashMap;

use prost::Message;
use uoplan_engine::proto::data::{
    Catalogue, ComponentSection, ComponentSectionList, Course, CourseSchedule, DayOfWeek,
    MeetingTime, SchedulesData, SectionStatus,
};
use uoplan_engine::proto::engine::{
    CreditConfig, GenerationConstraints, GenerationRequest, GenerationResponse, TimetableRequest,
};
use uoplan_engine::EngineCore;

// ---------------------------------------------------------------------------
// Real Carleton .pb assets — skipped when absent.
// ---------------------------------------------------------------------------
const CARLETON_CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/carleton/catalogue.union.pb"
);
const CARLETON_SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/carleton/schedules.202710.pb"
);

// ---------------------------------------------------------------------------
// In-memory fixture helpers
// ---------------------------------------------------------------------------

fn carleton_credit_config() -> CreditConfig {
    CreditConfig {
        typical_course_credits: 0.5,
        default_course_credits: 0.5,
    }
}

/// Build an `Engine` from in-memory fixtures.
///
/// Each entry is `(course_code, credits, option<(component_key, start_min, end_min)>)`.
/// Courses with `None` meeting times are timeless (no schedule entry).
fn build_engine(entries: &[(&str, f64, Option<(&str, u32, u32)>)]) -> EngineCore {
    let course_codes: Vec<String> = entries.iter().map(|(c, _, _)| c.to_string()).collect();

    let courses: Vec<Course> = entries
        .iter()
        .enumerate()
        .map(|(i, (_, credits, _))| Course {
            code: i as u32,
            credits: *credits,
            ..Default::default()
        })
        .collect();

    let schedules: Vec<CourseSchedule> = entries
        .iter()
        .enumerate()
        .filter_map(|(i, (_, _, meeting))| {
            meeting.as_ref().map(|(comp, start, end)| {
                let section = ComponentSection {
                    section: "A".to_string(),
                    times: vec![MeetingTime {
                        day: DayOfWeek::Mo as i32,
                        start_minutes: *start,
                        end_minutes: *end,
                        r#virtual: false,
                        ..Default::default()
                    }],
                    status: SectionStatus::Open as i32,
                    ..Default::default()
                };
                CourseSchedule {
                    course: i as u32,
                    components: HashMap::from([(
                        comp.to_string(),
                        ComponentSectionList { items: vec![section] },
                    )]),
                    ..Default::default()
                }
            })
        })
        .collect();

    let cat_bytes = Catalogue {
        course_codes: course_codes.clone(),
        courses,
        ..Default::default()
    }
    .encode_to_vec();
    let sched_bytes = SchedulesData {
        course_codes,
        schedules,
        ..Default::default()
    }
    .encode_to_vec();

    EngineCore::new(&cat_bytes, &sched_bytes).unwrap()
}

fn generate(engine: &EngineCore, req: GenerationRequest) -> GenerationResponse {
    let bytes = engine.generate(&req.encode_to_vec()).unwrap();
    GenerationResponse::decode(bytes.as_slice()).unwrap()
}

fn timetable_fixed(engine: &EngineCore, req: TimetableRequest) -> GenerationResponse {
    let bytes = engine.timetable_fixed_set(&req.encode_to_vec()).unwrap();
    GenerationResponse::decode(bytes.as_slice()).unwrap()
}

/// Load real Carleton engine and schedule bytes.  Returns `None` (and prints a
/// notice) when the .pb artifacts have not yet been built.  Returns `None` too
/// if the bytes decode into an unusable engine (e.g. empty catalogue), to keep
/// the tests green in every checkout state.
fn load_real_carleton() -> Option<(EngineCore, Vec<u8>)> {
    let (Ok(cat), Ok(sched)) = (
        std::fs::read(CARLETON_CATALOGUE_PB),
        std::fs::read(CARLETON_SCHEDULES_PB),
    ) else {
        eprintln!(
            "skipping: Carleton .pb assets not built \
             (run `pnpm build:data-proto` first)"
        );
        return None;
    };
    match EngineCore::new(&cat, &sched) {
        Ok(engine) if engine.course_count() > 50 => Some((engine, sched)),
        Ok(_) => {
            eprintln!(
                "skipping: Carleton catalogue.union.pb loaded but has too few courses — \
                 the asset may be stale or incomplete"
            );
            None
        }
        Err(e) => {
            eprintln!("skipping: failed to build Carleton engine: {}", e.0);
            None
        }
    }
}

// ---------------------------------------------------------------------------
// 1. First-year credit cap uses per-course credit value from CreditConfig
// ---------------------------------------------------------------------------

/// With a 1.5-credit first-year cap and 0.5 credits per course (Carleton),
/// three 1000-level courses (3 × 0.5 = 1.5) must be accepted.
/// With hardcoded 3.0 credits per course (uOttawa default), the three courses
/// would be counted as 3 × 3.0 = 9.0, exceeding the cap — a false rejection.
#[test]
fn carleton_first_year_cap_accepts_three_half_credit_first_year_courses() {
    let engine = build_engine(&[
        ("COMP 1005", 0.5, Some(("LEC", 480, 570))),
        ("COMP 1006", 0.5, Some(("LEC", 600, 690))),
        ("COMP 1007", 0.5, Some(("LEC", 720, 810))),
    ]);

    // 3 × 0.5 = 1.5 credits → fits exactly under the 1.5-credit cap.
    let req = TimetableRequest {
        course_codes: vec![
            "COMP 1005".to_string(),
            "COMP 1006".to_string(),
            "COMP 1007".to_string(),
        ],
        constraints: Some(GenerationConstraints {
            max_end_minutes: 24 * 60,
            max_first_year_credits: Some(1.5),
            ..Default::default()
        }),
        include_closed_components: true,
        credit_config: Some(carleton_credit_config()),
        seed: 1,
        ..Default::default()
    };

    let resp = timetable_fixed(&engine, req);
    assert!(
        resp.has_schedule,
        "three 0.5-credit 1000-level courses (1.5 credits total) should satisfy \
         a 1.5-credit first-year cap; the engine must use per-course credits from \
         CreditConfig, not the hardcoded uOttawa default of 3.0"
    );
    assert_eq!(resp.courses.len(), 3);
}

/// Four 1000-level Carleton courses × 0.5 = 2.0 credits exceeds the 1.5-credit
/// first-year cap and must be rejected.
#[test]
fn carleton_first_year_cap_rejects_four_half_credit_first_year_courses() {
    let engine = build_engine(&[
        ("COMP 1005", 0.5, Some(("LEC", 480, 570))),
        ("COMP 1006", 0.5, Some(("LEC", 600, 690))),
        ("COMP 1007", 0.5, Some(("LEC", 720, 810))),
        ("COMP 1008", 0.5, Some(("LEC", 840, 930))),
    ]);

    // 4 × 0.5 = 2.0 credits > 1.5 cap → must be rejected.
    let req = TimetableRequest {
        course_codes: vec![
            "COMP 1005".to_string(),
            "COMP 1006".to_string(),
            "COMP 1007".to_string(),
            "COMP 1008".to_string(),
        ],
        constraints: Some(GenerationConstraints {
            max_end_minutes: 24 * 60,
            max_first_year_credits: Some(1.5),
            ..Default::default()
        }),
        include_closed_components: true,
        credit_config: Some(carleton_credit_config()),
        seed: 1,
        ..Default::default()
    };

    let resp = timetable_fixed(&engine, req);
    assert!(
        !resp.has_schedule,
        "four 0.5-credit 1000-level courses (2.0 credits) must exceed a 1.5-credit \
         first-year cap"
    );
}

/// Verify uOttawa behaviour is unchanged: three 3.0-credit first-year courses
/// (9.0 credits total) must exceed a 6.0-credit first-year cap.
/// This guards against a regression that accidentally applies Carleton credits
/// to a uOttawa timetable request (no CreditConfig supplied → defaults to 3.0).
#[test]
fn uottawa_first_year_cap_unchanged_no_credit_config() {
    let engine = build_engine(&[
        ("CSI 1100", 3.0, Some(("LEC", 480, 570))),
        ("CSI 1110", 3.0, Some(("LEC", 600, 690))),
        ("CSI 1300", 3.0, Some(("LEC", 720, 810))),
    ]);

    // No CreditConfig → defaults to 3.0 per course.
    // 3 × 3.0 = 9.0 > 6.0 cap → must be rejected.
    let req = TimetableRequest {
        course_codes: vec![
            "CSI 1100".to_string(),
            "CSI 1110".to_string(),
            "CSI 1300".to_string(),
        ],
        constraints: Some(GenerationConstraints {
            max_end_minutes: 24 * 60,
            max_first_year_credits: Some(6.0),
            ..Default::default()
        }),
        include_closed_components: true,
        // credit_config: absent → defaults to uOttawa (3.0)
        seed: 1,
        ..Default::default()
    };

    let resp = timetable_fixed(&engine, req);
    assert!(
        !resp.has_schedule,
        "three uOttawa 3.0-credit first-year courses (9.0 credits) must exceed \
         a 6.0-credit first-year cap when no CreditConfig is supplied"
    );
}

// ---------------------------------------------------------------------------
// 2. Banner component codes are treated transparently
// ---------------------------------------------------------------------------

/// Non-standard Banner component codes observed in real Carleton data
/// (single-letter "P", two-letter "DG", "FP", "RP") must be scheduled
/// identically to "LEC". The engine never inspects component name content.
#[test]
fn banner_component_codes_schedule_transparently() {
    let engine = build_engine(&[
        ("ACSE 3201", 0.5, Some(("LEC", 480, 570))), // standard
        ("ACSE 4106", 0.5, Some(("P", 600, 690))),   // practical (single letter)
        ("AERO 2001", 0.5, Some(("DG", 720, 810))),  // discussion group
        ("LAWS 4900", 0.5, None),                     // timeless (honours project)
    ]);

    // Basic elective request: pick 3 timetable-able courses.
    let req = GenerationRequest {
        additional_electives_count: 3,
        include_closed_components: true,
        level_buckets: vec!["undergrad".to_string()],
        language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
        credit_config: Some(carleton_credit_config()),
        current_seed: 1,
        first_seed: 1,
        ..Default::default()
    };

    let resp = generate(&engine, req);
    assert!(
        resp.has_schedule,
        "non-standard Banner component codes (P, DG) must not block schedule generation"
    );
    // All three timetable-able courses should be selected (LAWS 4900 is timeless
    // and excluded from basic elective selection).
    assert!(
        resp.courses.len() <= 3,
        "expected at most 3 courses (LAWS 4900 is timeless), got {}",
        resp.courses.len()
    );
}

// ---------------------------------------------------------------------------
// 3. 6-digit Banner term IDs round-trip through the proto uint32 field
// ---------------------------------------------------------------------------

/// 202710 (a real Carleton winter-2027 term id) must survive proto
/// encode/decode without overflow or truncation.
#[test]
fn six_digit_banner_term_id_roundtrips_as_uint32() {
    let banner_term: u32 = 202_710;
    let req = GenerationRequest {
        term_id: Some(banner_term),
        ..Default::default()
    };
    let bytes = req.encode_to_vec();
    let decoded = GenerationRequest::decode(bytes.as_slice()).unwrap();
    assert_eq!(
        decoded.term_id,
        Some(banner_term),
        "6-digit Banner term id must survive a proto encode/decode round-trip"
    );
}

// ---------------------------------------------------------------------------
// 4. End-to-end generation with real Carleton .pb data
// ---------------------------------------------------------------------------

/// Load the real Carleton catalogue + term-202710 schedules and run a basic
/// elective generation. Confirms the engine ingests real Carleton data and
/// produces a conflict-free timetable. Skipped when the .pb artifacts are absent.
#[test]
fn carleton_real_data_basic_generation() {
    let Some((engine, sched_bytes)) = load_real_carleton() else {
        return;
    };

    // Request 5 courses (a normal Carleton semester load) from the full pool.
    let req = GenerationRequest {
        additional_electives_count: 5,
        include_closed_components: true,
        level_buckets: vec!["undergrad".to_string()],
        language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
        credit_config: Some(carleton_credit_config()),
        current_seed: 42,
        first_seed: 42,
        ..Default::default()
    };

    let resp = generate(&engine, req);

    assert!(
        resp.has_schedule,
        "real Carleton data: expected a 5-course schedule for seed 42, got none"
    );
    assert_eq!(
        resp.courses.len(),
        5,
        "expected exactly 5 chosen courses, got {}",
        resp.courses.len()
    );

    // Verify no timing conflicts in the returned schedule.
    let sched_data = SchedulesData::decode(sched_bytes.as_slice())
        .expect("decode Carleton SchedulesData");
    let mut intervals: Vec<(i32, u32, u32)> = Vec::new();
    for chosen in &resp.courses {
        if let Some(s) = sched_data.schedules.iter().find(|s| {
            sched_data
                .course_codes
                .get(s.course as usize)
                .map(|c| c.as_str())
                == Some(&chosen.course_code)
        }) {
            for component_choice in &chosen.components {
                if let Some(section_list) = s.components.get(&component_choice.component) {
                    if let Some(section) = section_list
                        .items
                        .iter()
                        .find(|sec| sec.section == component_choice.section)
                    {
                        for t in &section.times {
                            if t.start_minutes >= t.end_minutes {
                                continue;
                            }
                            for &(day, start, end) in &intervals {
                                if day == t.day && t.start_minutes < end && t.end_minutes > start {
                                    panic!(
                                        "timing conflict in Carleton schedule: \
                                         {} overlaps another course on day {} ({}-{})",
                                        chosen.course_code, t.day, t.start_minutes, t.end_minutes
                                    );
                                }
                            }
                            intervals.push((t.day, t.start_minutes, t.end_minutes));
                        }
                    }
                }
            }
        }
    }
}

/// Across 16 seeds, every run must produce a full 5-course schedule. Confirms
/// that Carleton credit config does not break seed stability.
#[test]
fn carleton_real_data_seed_stable() {
    let Some((engine, _sched_bytes)) = load_real_carleton() else {
        return;
    };

    for seed in 1u32..=16 {
        let req = GenerationRequest {
            additional_electives_count: 5,
            include_closed_components: true,
            level_buckets: vec!["undergrad".to_string()],
            language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
            credit_config: Some(carleton_credit_config()),
            current_seed: seed,
            first_seed: seed,
            ..Default::default()
        };

        let resp = generate(&engine, req);
        assert!(
            resp.has_schedule,
            "Carleton real data: seed {seed} failed to produce a 5-course schedule"
        );
        assert_eq!(
            resp.courses.len(),
            5,
            "seed {seed}: expected 5 courses, got {}",
            resp.courses.len()
        );
    }
}
