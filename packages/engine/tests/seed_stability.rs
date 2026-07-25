//! Seed-stability regression for the timetabler.
//!
//! Reproduces the reported bug: building a large schedule (~23-24 courses) used to
//! *sometimes* succeed and *sometimes* fail depending only on the RNG seed, because
//! the naive backtracker thrashed and was killed by the worker's wall-clock timeout.
//! The forward-checking + MRV solver must find a conflict-free arrangement whenever
//! one exists, **for every seed**, well within the internal deterministic budget.
//!
//! Runs against the committed `.pb` datasets (built by `pnpm build:data-proto`).
//! When the artifacts are absent the test prints a notice and passes, so it stays
//! green in a clean checkout.

use prost::Message;
use uoplan_engine::proto::data::SchedulesData;
use uoplan_engine::proto::engine::{GenerationResponse, TimetableRequest};
use uoplan_engine::Engine;

const CATALOGUE_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/uottawa/catalogue.2026.pb"
);
const SCHEDULES_PB: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../apps/web/src/assets/data/uottawa/schedules.2269.pb"
);

/// Target size for the stress set (the reported failure was ~23-24 courses).
const TARGET_COURSES: usize = 24;
/// Minimum size required for the assertion to be meaningful (the reported failure
/// was ~23-24 courses, so a trivially small set would not exercise the regression).
const MIN_COURSES: usize = 20;
/// Number of distinct seeds to probe; the outcome must be identical for all of them.
const SEEDS: u32 = 256;

fn timetable(engine: &Engine, codes: &[String], seed: u32) -> GenerationResponse {
    let req = TimetableRequest {
        course_codes: codes.to_vec(),
        seed,
        include_closed_components: true,
        ..Default::default()
    };
    let bytes = engine.timetable_fixed_set(&req.encode_to_vec()).unwrap();
    GenerationResponse::decode(bytes.as_slice()).unwrap()
}

#[test]
fn large_fixed_set_is_seed_stable() {
    let (Ok(cat_bytes), Ok(sched_bytes)) =
        (std::fs::read(CATALOGUE_PB), std::fs::read(SCHEDULES_PB))
    else {
        eprintln!("skipping large_fixed_set_is_seed_stable: .pb artifacts not built");
        return;
    };

    let sched = SchedulesData::decode(sched_bytes.as_slice()).unwrap();
    let mut schedulable: Vec<String> = Vec::new();
    for s in &sched.schedules {
        if s.components.is_empty() {
            continue;
        }
        if let Some(code) = sched.course_codes.get(s.course as usize) {
            schedulable.push(code.clone());
        }
    }
    schedulable.sort();
    schedulable.dedup();

    let engine = Engine::new(&cat_bytes, &sched_bytes).unwrap();

    // Greedily build a set that provably admits a conflict-free arrangement: only
    // keep a course if the growing set still timetables (probed at a fixed seed).
    let mut chosen: Vec<String> = Vec::new();
    for code in &schedulable {
        if chosen.len() >= TARGET_COURSES {
            break;
        }
        let mut trial = chosen.clone();
        trial.push(code.clone());
        if timetable(&engine, &trial, 1).has_schedule {
            chosen = trial;
        }
    }

    assert!(
        chosen.len() >= MIN_COURSES,
        "could not assemble a fittable stress set (got {})",
        chosen.len()
    );

    // The set fit at seed 1, so a solution exists. A complete solver must therefore
    // succeed for EVERY seed — never "out of schedules" for some seeds and not others.
    let start = std::time::Instant::now();
    for seed in 0..SEEDS {
        let resp = timetable(&engine, &chosen, seed);
        assert!(
            resp.has_schedule,
            "seed {seed} failed to timetable a {}-course set that is known to be satisfiable",
            chosen.len()
        );
        assert_eq!(
            resp.courses.len(),
            chosen.len(),
            "seed {seed} returned an incomplete arrangement"
        );
    }
    let elapsed = start.elapsed();

    // Loose performance guard: with FC+MRV the whole 256-seed sweep is near-instant.
    // The pre-fix thrashing solver would blow far past this on a hard set.
    assert!(
        coverage_instrumented() || elapsed.as_secs() < 20,
        "seed sweep took too long ({elapsed:?}); the timetabler may be thrashing"
    );
}

/// True when running under coverage instrumentation (`cargo llvm-cov`), where
/// wall-clock timing is heavily skewed; the loose performance guard is relaxed
/// while correctness assertions still run.
fn coverage_instrumented() -> bool {
    std::env::var_os("LLVM_PROFILE_FILE").is_some()
}
