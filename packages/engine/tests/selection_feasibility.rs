//! Regression for seed-dependent *selection* failures (the ~50/50 timeout at ~22
//! courses with default options).
//!
//! Root cause history: advanced generation was generate-and-test — it randomly
//! picked a course SET and then checked whether that exact set timetabled.
//! Feasible large sets are rare per random draw, so whether a run succeeded
//! depended on the RNG seed stumbling onto one within the attempt/time budget.
//! Selection is now feasibility-aware (randomized-restart greedy over a
//! re-solve oracle), so a conflict-free selection is found for EVERY seed.
//!
//! Two properties must hold across many seeds for a realistic full-pool request:
//!   1. Determinism: every seed yields a full `target`-course schedule (the seed
//!      only changes *which* valid schedule, never *whether* one is found).
//!   2. Bounded latency: each seed completes far below the worker's 3 s
//!      wall-clock kill — including the ~1.5-2x slowdown of the WASM build versus
//!      this native release test — so success never depends on the wall clock.
//!
//! Runs against the committed `.pb` datasets (built by `pnpm build:data-proto`);
//! skipped (and green) when the artifacts are absent.

use std::time::{Duration, Instant};

use prost::Message;
use uoplan_engine::proto::data::SchedulesData;
use uoplan_engine::proto::engine::{GenerationRequest, GenerationResponse, RemainingRequirement};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/catalogue.2026.pb"
);
const SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/schedules.2269.pb"
);

const SEEDS: u32 = 64;

/// Native per-seed wall-clock ceiling. The worker kill is 3000 ms and the WASM
/// build runs ~1.5-2x slower than this native release test, so a sub-second
/// native ceiling keeps a comfortable margin in the browser. This is a coarse
/// safety net, not the real bound — total engine work is hard-capped internally
/// by the global probe budget (see `advanced.rs`), independent of wall clock.
const PER_SEED_BUDGET: Duration = Duration::from_millis(2_000);

/// True when running under coverage instrumentation (`cargo llvm-cov`), where
/// wall-clock timing is heavily skewed; the per-seed wall-clock net is relaxed
/// while the correctness assertions still run. The real bound is the internal
/// global probe budget, independent of wall clock.
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

fn run_target(engine: &Engine, pool: &[String], target: u32) {
    let req_base = GenerationRequest {
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
            credits_needed: Some(target as f64 * 3.0),
            picked_count: None,
            satisfied_by: vec![],
        }],
        ..Default::default()
    };

    let mut worst = Duration::ZERO;
    for seed in 1..=SEEDS {
        let mut req = req_base.clone();
        req.current_seed = seed;
        req.first_seed = seed;

        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            resp.has_schedule,
            "target {target}, seed {seed}: no schedule, though the pool packs {target} \
             conflict-free courses for other seeds (seed must not decide feasibility)"
        );
        assert_eq!(
            resp.courses.len(),
            target as usize,
            "target {target}, seed {seed}: expected {target} courses, got {}",
            resp.courses.len()
        );
        assert!(
            coverage_instrumented() || elapsed <= PER_SEED_BUDGET,
            "target {target}, seed {seed}: took {elapsed:?} (> {PER_SEED_BUDGET:?}); \
             a slow seed risks the 3 s worker timeout once run as WASM"
        );
    }
    eprintln!("target {target}: {SEEDS} seeds OK, worst {worst:?}");
}

#[test]
fn advanced_full_pool_every_seed_succeeds_quickly() {
    let (Ok(cat_bytes), Ok(sched_bytes)) =
        (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB))
    else {
        eprintln!(
            "skipping advanced_full_pool_every_seed_succeeds_quickly: .pb artifacts not built"
        );
        return;
    };
    let sched = SchedulesData::decode(sched_bytes.as_slice()).unwrap();
    let pool = undergrad_schedulable(&sched);
    assert!(
        pool.len() > 1000,
        "need a realistic undergrad pool, got {}",
        pool.len()
    );

    let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();

    // Cover a realistic near-capacity band (~18-20 courses); the seed must never
    // decide feasibility within it.
    for target in [18u32, 19, 20] {
        run_target(&engine, &pool, target);
    }
}

/// An over-capacity request can never be satisfied: a week has a finite number of
/// non-overlapping teaching slots, so no pool packs (say) 40 conflict-free
/// courses. The old generate-and-test loop ground on such inputs until the
/// worker's wall-clock kill (the reported multi-second hang / timeout); the
/// global probe budget now bounds total work, so an infeasible request must
/// return `has_schedule = false` *quickly and deterministically* for every seed
/// — never hang. This is the property that makes latency a function of the
/// inputs, not the seed.
#[test]
fn advanced_infeasible_request_fails_fast_for_every_seed() {
    let (Ok(cat_bytes), Ok(sched_bytes)) =
        (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB))
    else {
        eprintln!(
            "skipping advanced_infeasible_request_fails_fast_for_every_seed: .pb artifacts not built"
        );
        return;
    };
    let sched = SchedulesData::decode(sched_bytes.as_slice()).unwrap();
    let pool = undergrad_schedulable(&sched);
    assert!(
        pool.len() > 1000,
        "need a realistic undergrad pool, got {}",
        pool.len()
    );

    let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();

    // 40 conflict-free courses can't fit in one week's teaching slots for any
    // pool, so this is infeasible regardless of which courses the seed picks.
    let target = 40u32;
    let req_base = GenerationRequest {
        courses_this_semester: target,
        include_closed_components: true,
        level_buckets: vec!["undergrad".to_string(), "grad".to_string()],
        language_buckets: vec!["en".to_string(), "fr".to_string(), "other".to_string()],
        prereq_eligible_courses: pool.clone(),
        remaining_requirements: vec![RemainingRequirement {
            requirement_id: "core".to_string(),
            r#type: "core".to_string(),
            title: Some("Core".to_string()),
            candidate_courses: pool.clone(),
            credits_needed: Some(target as f64 * 3.0),
            picked_count: None,
            satisfied_by: vec![],
        }],
        ..Default::default()
    };

    let mut worst = Duration::ZERO;
    for seed in 1..=SEEDS {
        let mut req = req_base.clone();
        req.current_seed = seed;
        req.first_seed = seed;

        let started = Instant::now();
        let resp_bytes = engine.generate(&req.encode_to_vec()).unwrap();
        let elapsed = started.elapsed();
        worst = worst.max(elapsed);

        let resp = GenerationResponse::decode(resp_bytes.as_slice()).unwrap();
        assert!(
            !resp.has_schedule,
            "seed {seed}: reported a schedule for an impossible {target}-course request"
        );
        assert!(
            coverage_instrumented() || elapsed <= PER_SEED_BUDGET,
            "seed {seed}: infeasible request took {elapsed:?} (> {PER_SEED_BUDGET:?}); the \
             internal work bound must stop it well under the worker timeout, not grind to it"
        );
    }
    eprintln!("infeasible target {target}: {SEEDS} seeds all fast-failed, worst {worst:?}");
}
