//! Regression: enabling a timetable-shape optimization objective must NOT
//! multiply generation latency past the worker's wall-clock kill.
//!
//! Root cause history: a shape objective (`free_days` / `good_breaks` /
//! `compact`) flips `Objectives::candidate_count()` from 1 to `BEST_OF_K` (32),
//! so `run_generation` ran the FULL select+timetable pass 32 times and kept the
//! best by the priority comparator. On a realistic full pool (made heavier still
//! by an uploaded transcript) a single pass is already a sizeable fraction of the
//! 3 s worker timeout, so 32x reliably blew past it — the user saw "fails to
//! generate" the moment any objective was enabled.
//!
//! Fix: best-of-K shares ONE generation's worth of selection work across all
//! attempts. Attempt 0 keeps the full budget (feasibility parity with the
//! objective-off path); further attempts run only while budget remains, so total
//! work — and thus latency — stays a function of the inputs, never of K.
//!
//! This test asserts that a feasible full-pool request with `good_breaks` enabled
//! still returns a complete schedule AND completes well within a single
//! generation's wall-clock budget (NOT ~32x it). Runs against the committed `.pb`
//! datasets; skipped (and green) when the artifacts are absent.

use std::time::{Duration, Instant};

use prost::Message;
use uoplan_engine::proto::data::SchedulesData;
use uoplan_engine::proto::engine::{
    GenerationRequest, GenerationResponse, OptimizationKind, OptimizationPriority,
    RemainingRequirement,
};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/catalogue.2026.pb"
);
const SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/schedules.2269.pb"
);

/// Native ceiling for a SINGLE best-of-K generation that has a shape objective
/// active. The worker kill is 3000 ms and the WASM build runs ~1.5-2x slower
/// than this native release test. With the work-sharing fix, total selection
/// work across all K attempts is bounded by one generation's budget (~1.25 s
/// native worst case), so this leaves margin. WITHOUT the fix, 32 independent
/// full passes blow far past this (and past the 3 s worker kill in WASM).
const GENERATION_BUDGET: Duration = Duration::from_millis(2_500);

/// True under coverage instrumentation (`cargo llvm-cov`), where wall-clock
/// timing is heavily skewed; the wall-clock net is relaxed while the
/// feasibility assertions still run.
fn coverage_instrumented() -> bool {
    std::env::var_os("LLVM_PROFILE_FILE").is_some()
}

fn undergrad_schedulable(sched: &SchedulesData) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for s in &sched.schedules {
        if s.components.is_empty() {
            continue;
        }
        let Some(code) = sched.course_codes.get(s.course as usize) else {
            continue;
        };
        let first_digit = code
            .chars()
            .skip_while(|c| c.is_alphabetic())
            .find(|c| c.is_ascii_digit())
            .and_then(|c| c.to_digit(10));
        if matches!(first_digit, Some(1..=4)) {
            out.push(code.clone());
        }
    }
    out.sort();
    out.dedup();
    out
}

fn good_breaks_priority() -> OptimizationPriority {
    OptimizationPriority {
        kind: OptimizationKind::GoodBreaks as i32,
        enabled: true,
        break_count: 1,
        break_target_minutes: 60,
    }
}

fn load_engine_and_pool() -> Option<(Engine, Vec<String>)> {
    let (Ok(cat_bytes), Ok(sched_bytes)) =
        (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB))
    else {
        return None;
    };
    let sched = SchedulesData::decode(sched_bytes.as_slice()).unwrap();
    let pool = undergrad_schedulable(&sched);
    assert!(
        pool.len() > 1000,
        "need a realistic undergrad pool, got {}",
        pool.len()
    );
    let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();
    Some((engine, pool))
}

fn full_pool_request(pool: &[String], target: u32, with_objective: bool) -> GenerationRequest {
    GenerationRequest {
        courses_this_semester: target,
        include_closed_components: true,
        level_buckets: vec!["undergrad".to_string(), "grad".to_string()],
        language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
        prereq_eligible_courses: pool.to_vec(),
        remaining_requirements: vec![RemainingRequirement {
            requirement_id: "core".to_string(),
            r#type: "core".to_string(),
            title: Some("Core".to_string()),
            candidate_courses: pool.to_vec(),
            credits_needed: Some(f64::from(target) * 3.0),
            picked_count: None,
            satisfied_by: vec![],
        }],
        optimization_priorities: if with_objective {
            vec![good_breaks_priority()]
        } else {
            vec![]
        },
        ..Default::default()
    }
}

/// THE timeout repro. An over-capacity request (40 conflict-free courses can't
/// fit one week) makes every selection attempt burn the FULL global probe budget
/// before fast-failing. Enabling a shape objective runs best-of-K = 32 of those
/// full-budget attempts; pre-fix that was ~32x a single ~1.25 s native burn (tens
/// of seconds native, far past the 3 s worker kill in WASM). With the
/// work-sharing fix the 32 attempts share ONE generation's budget, so total work
/// — feasible or not — is bounded to roughly a single attempt.
#[test]
fn shape_objective_infeasible_is_bounded() {
    let Some((engine, pool)) = load_engine_and_pool() else {
        eprintln!("skipping shape_objective_infeasible_is_bounded: .pb artifacts not built");
        return;
    };

    let mut req = full_pool_request(&pool, 40, true);
    let mut worst = Duration::ZERO;
    for seed in 1..=4u32 {
        req.current_seed = seed;
        req.first_seed = seed;
        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            !resp.has_schedule,
            "seed {seed}: 40 courses can't pack into one week, expected no schedule"
        );
        assert!(
            coverage_instrumented() || elapsed <= GENERATION_BUDGET,
            "seed {seed}: best-of-K with a shape objective took {elapsed:?} (> {GENERATION_BUDGET:?}); \
             total work must be bounded to one generation's budget, not ~32x it"
        );
    }
    eprintln!("shape_objective_infeasible_is_bounded: 4 seeds OK, worst {worst:?}");
}

/// Feasibility parity: enabling a shape objective must NOT cost feasibility. A
/// feasible full-pool request still returns a complete schedule (attempt 0 keeps
/// the full per-attempt budget under the work-sharing fix), and stays well within
/// one generation's wall-clock budget.
#[test]
fn shape_objective_feasible_still_succeeds() {
    let Some((engine, pool)) = load_engine_and_pool() else {
        eprintln!("skipping shape_objective_feasible_still_succeeds: .pb artifacts not built");
        return;
    };

    // A realistic near-capacity load (~20 courses) with an optimization objective
    // enabled.
    let target = 20u32;
    let mut req = full_pool_request(&pool, target, true);
    let mut worst = Duration::ZERO;
    for seed in 1..=8u32 {
        req.current_seed = seed;
        req.first_seed = seed;
        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            resp.has_schedule,
            "seed {seed}: no schedule with good_breaks enabled, though the pool packs \
             {target} conflict-free courses (enabling an objective must not break feasibility)"
        );
        assert_eq!(
            resp.courses.len(),
            target as usize,
            "seed {seed}: expected {target} courses, got {}",
            resp.courses.len()
        );
        assert!(
            coverage_instrumented() || elapsed <= GENERATION_BUDGET,
            "seed {seed}: feasible best-of-K with a shape objective took {elapsed:?} \
             (> {GENERATION_BUDGET:?})"
        );
    }
    eprintln!("shape_objective_feasible_still_succeeds: 8 seeds OK, worst {worst:?}");
}
